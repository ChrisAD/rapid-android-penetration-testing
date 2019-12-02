const {app, BrowserWindow} = require('electron')
const url = require('url')
const path = require('path')

let win;

function createWindow() {
   win = new BrowserWindow({width: 1600, height: 600})
   win.loadURL(url.format ({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
   }))
}

app.on('ready', createWindow)
/** Load external links with browser, not from within Electron
 * TODO: Fix so new-window or different event handler is triggered upon clicks

BrowserWindow.webContents.on('new-window', function(e, url2) {
	e.preventDefault();
  require('electron').shell.openExternal(url2);
});
 */