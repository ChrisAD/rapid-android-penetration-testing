let $ = require("jquery"), 
	fs = require('fs'), 
	parseString = require("xml2js").parseString,
	xml2js = require("xml2js");


const remote = require('electron').remote,
	app = remote.app,
	userData = app.getPath('userData'),
	storePackagePath = userData + "\\packages\\";

let apkPackages = [];

const { exec } = require("child_process");

function downloadedPackages() {
	$("#title").html("Packages downloaded to system");
}

/*
	Todo: allow multiple attached devices
	TODO: Sort by latest installs
*/
function loadPackages() {
	$("#title").html("Loading packages...");
	exec("adb shell pm list packages", (err, stdout, stderr) => {
	  if (err) {
		$("#errors").html(`exec error: ${err}. Debug steps: \n
		- ADB must be available on your path.\n
		- Phone must be in developer mode\n
		- System must be trusted by phone (allow RSA signature)\n
		- apktool must be on system and in path`);
		return;
	  }
	  apkPackages = stdout.split(/\r?\n/);
	  $("#title").html("Installed packages");
		let totalPackages = apkPackages.length;
		$("#content").html("");
	  $("#content").html("<b>" + totalPackages + "</b> number of packages installed.");
	  $("#content").append("<button type='button' id='downloadAllPackages' class='btn btn-link' onclick='downloadAllPackages()'>Download all packages in table</button>");
	  $("#content").append("<table id='packages'>");
	  for (var i = 0; i < totalPackages-1; i++) {
		let pack = apkPackages[i].split(":")[1];
		$("#content").append("<tr>");
		let onClickLoadPackage = 'loadPackage("' + pack + '")';
		$("#content").append("<td><a href='#' class='loadPackage' id='" + pack + "' onclick='" + onClickLoadPackage + "'>" + pack + "</a></td>");
		let onClickFetchAPK = 'fetchAPK("' + pack + '")';
		$("#content").append("<td><a href='#' class='fetchAPK' id='fetchAPK-" + pack + "' onclick='" + onClickFetchAPK + "'>Download APK</a></td>");
		$("#content").append("</tr>");
	  }
	  $("#content").append("<table>");
	});
		
};

function createDirectory(directory, callback) {  
	raptLog(arguments.callee.name, directory);
	if (!fs.existsSync(directory)) {
		fs.mkdir(directory, callback);
	} else {
		callback();
	}
}

/** Logger function
 * Todo: Reflect this function across all functions? 
 */
function raptLog() {
	let log = "RaptLog: ";
	for (var i=0; i < arguments.length; i++) {
		log = log + arguments[i] + " ";
	}
	console.log(log);
}


function getPackagePath(pack, callback) {
	raptLog(arguments.callee.name, pack);
	exec("adb shell pm path " + pack, (err, stdout, stderr) => {
		if (err) {
			$("#errors").html(`exec error: ${err}`);
			return;
		} else {
			callback(stdout.split(":")[1].substring(0, stdout.split(":")[1].indexOf("\n")));
		}
	});
}

function installBurpProxy(pack) {
	raptLog(arguments.callee.name, pack);
	let apkStorePath = storePackagePath + pack;
	let decodePath = apkStorePath + "\\decoded\\"; 
	//Todo: This whole lot can/should be refactored into something smarter
	let resourcePath = decodePath + "\\res";
	if (!fs.existsSync(resourcePath)) {
		fs.mkdirSync(resourcePath);
	}
	let resourceXmlPath = resourcePath + "\\xml";
	if (!fs.existsSync(resourceXmlPath)) {
		fs.mkdirSync(resourceXmlPath);
	}
	let resourceRawPath = resourcePath + "\\raw"
	if (!fs.existsSync(resourceRawPath)) {
		fs.mkdirSync(resourceRawPath) ;
	}

	let androidManifestPath = decodePath + "\\AndroidManifest.xml";
	if (fs.existsSync(androidManifestPath)) {
		fs.readFile(androidManifestPath, "utf-8", function(err, data) {
			if (!err) { 
				parseString(data, function(err, result) {
					if (!err) {
						var json = result;
						json.manifest.application[0].$["android:networkSecurityConfig"] = "@xml\\network_security_config";
						var builder = new xml2js.Builder();
						var xml = builder.buildObject(json);
						fs.writeFile(androidManifestPath, xml, function(err, data) {
							if (err) $("#errors").html(err);
							let prevContent = $("#content").html()
							$("#content").html("Updated " + androidManifestPath).append("<br \>" + prevContent);
						});	
					} else {
						$("#errors").html(result);
					}
				});
			} else {
				$("#errors").html(result);
			}

		});
		} else {
			$("#errors").html("No AndroidManifest.xml in " + decodePath);
			return;
	}

	let networkSecurityConfigXmlPath = resourceXmlPath + "\\network_security_config.xml";
	if (!fs.existsSync(networkSecurityConfigXmlPath)) {
		let xml = `<?xml version="1.0" encoding="utf-8"?>
		<network-security-config>
				<base-config>
						<trust-anchors>
								<certificates src="system"/>
								<certificates src="user"/>
								<certificates src="@raw/trusted_root"/>
						</trust-anchors>
				</base-config>
		</network-security-config>`;
		fs.writeFile(networkSecurityConfigXmlPath, xml, function(err, data) {
      if (!err) {
				$("#title").html("Successfully written network_security_config.xml");
			} else {
				$("#errors").html(err);
			} 
		});
	} else {
		//TODO: Network config already exists. Bother with it?
		$("#errors").html("res\\xml\\network_security_config.xml already exists...");
	}
	//TODO: XML add attribute
	//TODO: Add res/raw/ca
	//TODO: Add res/xml/network
	/** 
	 * if grep -q 'android:"' base/AndroidManifest.xml; then
    echo "[+] networkSecurityConfig located, will not modify AndroidManifest.xml"
elif grep -q 'android:networkSecurityConfig' base/AndroidManifest.xml; then
    echo "[-] Different networkSecurityConfig found, verify location manually!"
    echo "Exiting"
    exit
else
    echo [+] adding networkSecurityConfig to base/AndroidManifest.xml
    sed -i 's/<application/<application android:networkSecurityConfig="@xml\/network_security_config"/' base/AndroidManifest.xml
fi


mkdir -p base/res/xml
mkdir -p base/res/raw/
curl -x $2 burp/cert --output base/res/raw/trusted_root.der


	 */
}

function decodeAPK(pack) {
	raptLog(arguments.callee.name, pack);
	let apkStorePath = storePackagePath + pack;
	let apkPath = apkStorePath + "\\base.apk";
	if (fs.existsSync(apkStorePath) && fs.existsSync(apkPath)) {
		let decodedPath = apkStorePath + "\\decoded"; 
		if (!fs.existsSync(decodedPath)) {
			fs.mkdirSync(decodedPath);
		}
		let command = "apktool -f d " + apkPath + " -o \"" + decodedPath + "\"";
		console.log(command);
		exec(command, (err, stdout, stderr) => {
			if (!err) {
				let prevContent = $("#title").html()
				//Todo: Replace all \n with <br /> not just the first. Syncronize exec? 
				$("#title").append("<br /> " + stdout.replace("/\n/g", "<br />"));
			} else {
				$("#errors").html(`exec error: ${err}`);
				return;				
			}
		});
	} else {
		$("#errors").html("Error... package not downloaded (directory or file does not exist).");
	}
}

function fetchAPK(pack) {
	raptLog(arguments.callee.name, pack);
	getPackagePath(pack, function(pathArray) {
		let apkStorePath = storePackagePath + pack;
		if (!fs.existsSync(storePackagePath)){
			fs.mkdirSync(storePackagePath);
		}
		createDirectory(apkStorePath, function (err) {
			$("#title").html("Fetching APK <b>" + pack + "</b> and storing it here: <b>" + apkStorePath + "</b><br />");	
			if (err) {
				$("#errors").html(`exec error: ${err}`);
			} else {
				console.log(pathArray);
				let command = "adb pull " + pathArray.replace(/(\r\n\t|\n|\r\t)/gm,"") + " " + apkStorePath+"\\base.apk";
				raptLog("Running command: " + command);
				exec(command, (err, stdout, stderr) => {
				if (err) {
					$("#errors").html(`exec error: ${err}`);
					return;
				} else {
					if (stdout.includes("1 file pulled.")) {
						$("#title").append("File downloaded into " + apkStorePath + "<br />");
					}
				}
				});
			}
			});
	});		

}

function installAPK(pack) {
	raptLog(arguments.callee.name, pack);
}

/** Load a single package into RAPT */
function loadPackage(pack) {
	$("#title").html("Displaying package " + pack);
	//if package already exist on file system, display info
	let apkStorePath = storePackagePath + pack;
	if (fs.existsSync(apkStorePath)){
		$("#title").append("<br />Package already downloaded at: " + apkStorePath);
	}
	$("#content").html("");

		$("#content").append("<button type='button' id='getAPK'>Download APK</button>");
		$("#getAPK").click(function () {
			fetchAPK(pack);
		});
		$("#content").append("<button type='button' id='decodeAPK'>Decode APK</button>");
		$("#decodeAPK").click(function () {
			decodeAPK(pack);
		});
		$("#content").append("<button type='button' id='addBurp'>Add Burp Proxy</button>");
		$("#addBurp").click(function () {
			installBurpProxy(pack);
		});
		$("#content").append("<button type='button' id='installAPK'>Sign and Install APK</button>");
		$("#installAPK").click(function () {
			installAPK(pack);
		});		
		$("#content").append("<button type='button' id='installDrozer' disabled>Install Drozer</button>");
		$("#content").append("<button type='button' id='installFrida' disabled>Frida</button>");
		$("#content").append("<br /> <br /><webview id='playstore' src='https://play.google.com/store/apps/details?id=" + pack + "' style='display:inline-flex; width:100%; height:780px'></webview>");
}

/*
	Todo: allow multiple attached devices
*/
function loadDeviceInfo() {
	$("#title").html("Loading deviceInfo");
	$("#content").html("");
	exec("adb devices -l", (err, stdout, stderr) => {
	  if (err) {
		$("#errors").html(`exec error: ${err}`);
		return;
	  }
	   $("#title").html("Device info");
	   $("#content").append(`${stdout}` + "<br /> <br />");
	  
	});
	exec("adb shell getprop", (err, stdout, stderr) => {
	  if (err) {
		$("#errors").html(`exec error: ${err}` + "<br /><br />");
		return;
	  }
	  let deviceInfo = stdout.split(/\r?\n/);
	  for (var i = 0; i < deviceInfo.length; i++) {
		  $("#content").append(deviceInfo[i] + "<br />");
	  }
	});	
}


function loadAbout(){
	$("#errors").html("");
	$("#title").html("RAPT - Rapid Android Pentesting");
	$("#content").html("By Chris Dale - <a href='https://twitter.com/chrisadale' target='_blank'>@chrisadale</a> - <a href='https://netsecurity.no/en' target='_blank'>https://netsecurity.no/en</a>");
}

function downloadAllPackages(){
	let visiblePackages = $("#packages a:visible");
	for (i = 0; i < visiblePackages.length;i++) {
		fetchAPK(visiblePackages[i].innerHTML);
	}
}

function loadDownloadedPackages() {
	$("#title").html("Displaying packages which have been downloaded to this system");
	$("#content").html("");
	let packagesPath = app.getPath('userData') + "\\packages\\";
	$("#content").append("Files are stored in " + packagesPath + "<br />");
	fs.readdir(packagesPath, (err, files) => {
		files.forEach(file => {
			$("#content").append(file);
		});
	});

}

//Startup 
$("#packagesOption").click(function(e){
	loadPackages();
});
$("#deviceInfoOption").click(function(e){
	loadDeviceInfo();
});
$("#aboutOption").click(function(e){
	loadAbout();
});
$("#downloadedPackagesOption").click(function(e){
	loadDownloadedPackages();
});

loadPackages();

/** Filter links in #content   */
$("#searchPackages").on("keyup", function() {
	var value = $(this).val().toLowerCase();
	$("#content a").filter(function() {
		$(this).toggle($(this).html().toLowerCase().indexOf(value) > -1);
	});
});





