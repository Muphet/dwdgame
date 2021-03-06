const config = require('./config/server.json');
const http = require('http');
const path = require('path');
const express = require('express');
const DataLink = require('./modules/datalink');
const Parcel = require('parcel-bundler');
const Colyseus = require('colyseus');
const RoomGame = require('./modules/room-game').roomgame;
const RoomScene = require('./modules/room-scene').roomscene;
const share = require('../shared/constants');
// server:
const app = express();
const port = Number(process.env.PORT || config.port);
const server = http.createServer(app);
// game server:
const gameServer = new Colyseus.Server({server: server});
// main room:
gameServer.register(share.ROOM_GAME, RoomGame);
// game monitor:
if(config.colyseus_monitor){
    const monitor = require('@colyseus/monitor');
    // (optional) attach web monitoring panel
    app.use('/colyseus', monitor.monitor(gameServer));
}
// server shutdown:
gameServer.onShutdown(function(){
    console.log('Game Server is going down.');
});
var queryString = 'SELECT * FROM scenes';
var prom = new Promise((resolve, reject) => {
    DataLink.connection.query(queryString, {}, (err, rows) => {
        if(err){
            return reject({});
        }
        if(rows){
            resolve(rows);
        }
    });
});
prom.then(function(result){
    let counter = 0;
    for(let s in result){
        let scene = result[s];
        let temp = {
            sceneMap: scene.scene_map,
            image: scene.image,
            collisions: JSON.parse(scene.collisions),
            layers: JSON.parse(scene.layers),
            returnPositions: JSON.parse(scene.return_positions)
        };
        console.log('Registered scene: '+scene.name);
        gameServer.register(scene.name, RoomScene, {scene: temp});
        counter++;
    }
    console.log('Loaded '+counter+' scenes');
    // start:
    gameServer.listen(port);
    console.log('Listening on http://localhost:'+port);
    // bundler:
    const bundler = new Parcel(path.resolve(__dirname, '../client/index.html'));
    app.use(bundler.middleware());
}).catch(function(err){
    console.log('Server catch error: ', err);
});
