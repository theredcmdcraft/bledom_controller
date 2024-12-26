if ("bluetooth" in navigator && "permissions" in navigator) {
    document.getElementById("yesyes").style.display = "block";
} else {
    document.getElementById("nosupport").style.display = "block";
}

let brightness = [0, 0, 0];
let darkness = [0, 0, 0];
let rgbColor = null;
let colorMode = null;

if (localStorage.getItem("brightness")) {
    brightness = localStorage.getItem("brightness");
    document.getElementById("brightness").value = Number(brightness);
}

if (localStorage.getItem("colors") !== null) {
    let colors = localStorage.getItem("colors");
    if (JSON.parse(colors).length == 3) {
        rgbColor = JSON.parse(colors);
    } else if (Number.isInteger(Number(colors))) {
        colorMode = Number("0x" + (Number(colors).toString(16).toUpperCase()));
    } else {
        rgbColor = { r: 0, g: 255, b: 0 };
    }
} else {
    rgbColor = { r: 255, g: 0, b: 0 };
}

if (localStorage.getItem("darkness")) {
    darkness = localStorage.getItem("darkness");
}

let bluetoothDevice = null;

async function onDisconnected(event) {
    const device = event.target;
    console.log(`Device ${device.name} is disconnected.`);
    location.reload();
}

var char = null;
function searchBLEDom() {
    navigator.bluetooth.requestDevice({
        filters: [
            { services: ["0000fff0-0000-1000-8000-00805f9b34fb"] },
        ],
    }).then(async function (device) {
        console.log(device);
        device.addEventListener("gattserverdisconnected", onDisconnected);
        //return device.gatt.connect();

        const characteristic = await connect(device);

        console.log(characteristic);
        char = characteristic;
        document.getElementById("searchBtn").style.display = "none";
        document.getElementById("controls").style.display = "block";
        setInterval(attackRelease, 75);
        if (navigator.requestMIDIAccess) {
            document.getElementById("midiBtn").style.display = "inline-block";
        }

        console.log(rgbColor, colorMode);
        if (rgbColor) {
            setColor(rgbColor.r, rgbColor.g, rgbColor.b);
        } else if (colorMode) {
            setModeEffect(colorMode);
        }
    }).catch(function (err) {
        console.error(err);
    });
}

async function connect(device) {
    console.log("connecting...");

    let server = await device.gatt.connect();
    console.log("Connected!");
    //bluetoothDevice = server;

    /*if (!bluetoothDevice) {
     	server = await device.gatt.connect();
        console.log("Connected!");
        bluetoothDevice = server;
    } else {
        server = bluetoothDevice;
        server.connect();
        console.log("using saved bluetooth device!");
    }*/

    const service = await server.getPrimaryService(
        "0000fff0-0000-1000-8000-00805f9b34fb",
    );

    const characteristic = await service.getCharacteristic(
        "0000fff3-0000-1000-8000-00805f9b34fb",
    );

    return characteristic;
    /*return await exponentialBackoff(
        3, /* max retries * /
        2, /* seconds delay * /
        async function toTry() {
            console.log("Connecting to Bluetooth Device... ");
            const device = await bluetoothDevice.gatt.connect();
            return device;
        },
        function success() {
            console.log(
                "> Bluetooth Device connected. Try disconnect it now.",
            );
        },
        function fail() {
            console.log("Failed to reconnect.");
        },
    );*/
}

async function exponentialBackoff(max, delay, toTry, success, fail) {
    await toTry().then((result) => success(result))
        .catch((_) => {
            if (max === 0) {
                return fail();
            }
            console.log(
                "Retrying in " + delay + "s... (" + max + " tries left)",
            );
            setTimeout(function () {
                exponentialBackoff(--max, delay * 2, toTry, success, fail);
            }, delay * 1000);
        });
}

commandInProgress = false;
function sendCommand(command, onSuccess) {
    if (!commandInProgress) {
        commandInProgress = true;
        console.log("char", char);
        char.writeValue(command).then(function () {
            console.log("Command written to characteristic");
            commandInProgress = false;
            if (typeof onSuccess == "function") {
                onSuccess();
            }
        }).catch(function (err) {
            commandInProgress = false;
            console.error(err);
        });
    }
}

function setColor(r, g, b, onSuccess) {
    document.getElementById("customColorInput").value = rgbToHex(r, g, b);
    document.getElementById("modeSelect").value = "null";
    document.getElementById("dynamicSelect").value = "null";

    localStorage.setItem("colors", JSON.stringify([r, g, b]));
    var command = new Uint8Array([
        0x7e,
        0x00,
        0x05,
        0x03,
        limitHex(r),
        limitHex(g),
        limitHex(b),
        0x00,
        0xef,
    ]).buffer;
    sendCommand(command, onSuccess);
}

function setColorHex(hexColor, onSuccess) {
    if (hexColor == null || hexColor.trim() == "") {
        console.warn("Hex color is empty!");
        return;
    }
    rgbColor = hexToRgb(hexColor);
    setColor(rgbColor.r, rgbColor.g, rgbColor.b, onSuccess);
}

function setBrightness(brightness, onSuccess) {
    console.log("brightness", brightness);
    localStorage.setItem("brightness", brightness);
    var command = new Uint8Array([
        0x7e,
        0x00,
        0x01,
        limitPerc(brightness),
        0x00,
        0x00,
        0x00,
        0x00,
        0xef,
    ]).buffer;
    sendCommand(command, onSuccess);
}

function setEffectSpeed(speed) {
    var command = new Uint8Array([
        0x7e,
        0x00,
        0x02,
        limitPerc(speed),
        0x00,
        0x00,
        0x00,
        0x00,
        0xef,
    ]).buffer;
    sendCommand(command);
}

function sendPower(on = false) {
    if (on) {
        //power on
        let command = new Uint8Array([
            0x7e,
            0x00,
            0x04,
            0xf0,
            0x00,
            0x01,
            0xff,
            0x00,
            0xef,
        ]).buffer;

        sendCommand(command, () => {
            console.log("Power success");
        });
    } else {
        //power off
        let command = new Uint8Array([
            0x7e,
            0x00,
            0x04,
            0x00,
            0x00,
            0x00,
            0xff,
            0x00,
            0xef,
        ]).buffer;

        sendCommand(command, () => {
            console.log("Power success");
        });
    }
}

function setModeEffect(effect) {
    var effects = {
        red: 0x80,
        blue: 0x81,
        green: 0x82,
        cyan: 0x83,
        yellow: 0x84,
        magenta: 0x85,
        white: 0x86,
        jump_rgb: 0x87,
        jump_rgbycmw: 0x88,
        gradient_rgb: 0x89,
        gradient_rgbycmw: 0x8a,
        gradient_r: 0x8b,
        gradient_g: 0x8c,
        gradient_b: 0x8d,
        gradient_y: 0x8e,
        gradient_c: 0x8f,
        gradient_m: 0x90,
        gradient_w: 0x91,
        gradient_rg: 0x92,
        gradient_rb: 0x93,
        gradient_gb: 0x94,
        blink_rgbycmw: 0x95,
        blink_r: 0x96,
        blink_g: 0x97,
        blink_b: 0x98,
        blink_y: 0x99,
        blink_c: 0x9a,
        blink_m: 0x9b,
        blink_w: 0x9c,
    };

    if (Object.values(effects).includes(effect)) {
        effect = Object.keys(effects).find((key) => effects[key] === effect);
    }

    if (effect in effects) {
        localStorage.setItem("colors", limitHex(effects[effect]));
        var command = new Uint8Array([
            0x7e,
            0x00,
            0x03,
            limitHex(effects[effect]),
            0x03,
            0x00,
            0x00,
            0x00,
            0xef,
        ]).buffer;
        sendCommand(command);
    } else {
        throw new Error(effect + " is not a valid effect");
    }
    document.getElementById("dynamicSelect").value = "null";
}

function setModeDynamic(dynamic) {
    var command = new Uint8Array([
        0x7e,
        0x00,
        0x03,
        limitHex(dynamic),
        0x04,
        0x00,
        0x00,
        0x00,
        0xef,
    ]).buffer;
    sendCommand(command);
    document.getElementById("modeSelect").value = "null";
}

function setSensitivityForDynamicMode(sensitivity) {
    var command = new Uint8Array([
        0x7e,
        0x00,
        0x07,
        limitHex(sensitivity),
        0x00,
        0x00,
        0x00,
        0x00,
        0xef,
    ]).buffer;
    sendCommand(command);
}

function attackRelease() {
    if (!midiEnabled && useKbd) {
        // [ R, G, B ]
        var target = [0, 0, 0];
        var threshold = 0.001;
        var attack = parseFloat(document.getElementById("attack").value);
        var release = parseFloat(document.getElementById("release").value);
        var time = [release, release, release];

        if (!onlyOneKey) {
            if (keysPressed.indexOf(65) > -1) {
                target[0] = 255;
                time[0] = attack;
            }
            if (keysPressed.indexOf(83) > -1) {
                target[1] = 255;
                time[1] = attack;
            }
            if (keysPressed.indexOf(68) > -1) {
                target[2] = 255;
                time[2] = attack;
            }
        } else if (keysPressed.length > 0) {
            switch (keysPressed[keysPressed.length - 1]) {
                case 65: {
                    target[0] = 255;
                    time[0] = attack;
                    brightness[1] = 0;
                    brightness[2] = 0;
                    break;
                }
                case 83: {
                    target[1] = 255;
                    time[1] = attack;
                    brightness[0] = 0;
                    brightness[2] = 0;
                    break;
                }
                case 68: {
                    target[2] = 255;
                    time[2] = attack;
                    brightness[0] = 0;
                    brightness[1] = 0;
                    break;
                }
            }
        }

        var coeff = [0, 0, 0];

        time[0] = time[0] * 44100 * 0.001;
        time[1] = time[1] * 44100 * 0.001;
        time[2] = time[2] * 44100 * 0.001;
        coeff[0] = Math.pow(1.0 / threshold, -1.0 / time[0]);
        coeff[1] = Math.pow(1.0 / threshold, -1.0 / time[1]);
        coeff[2] = Math.pow(1.0 / threshold, -1.0 / time[2]);
        brightness[0] = Math.floor(
            (coeff[0] * brightness[0]) + ((1.0 - coeff[0]) * target[0]),
        );
        brightness[1] = Math.floor(
            (coeff[1] * brightness[1]) + ((1.0 - coeff[1]) * target[1]),
        );
        brightness[2] = Math.floor(
            (coeff[2] * brightness[2]) + ((1.0 - coeff[2]) * target[2]),
        );
        //if (!brightness.equals(darkness)) {
        //setBrightness(brightness);
        setColor(brightness[0], brightness[1], brightness[2]);
        //console.log(brightness);
        //}
    }
}
