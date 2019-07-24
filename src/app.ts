import { app, BrowserWindow } from 'electron';
import Main from './main';
import Api from './api';
import P2P from './p2p';
var fs = require('fs')

require('events').EventEmitter.defaultMaxListeners = 150;
var argv = require('minimist')(process.argv.slice(2))

if (argv.server === undefined) {
    console.log('Starting interface')
    Main.main(app, BrowserWindow);
}

Api.init()
P2P.init()

