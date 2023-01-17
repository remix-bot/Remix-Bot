// TODO: rename to index.js
const { CommandHandler } = require("./Commands.js");
const { Revoice } = require("revoice.js");
const { Client } = require("revolt.js");
const path = require("path");
const fs = require("fs");
const { SettingsManager } = require("./settings/Settings.js");
require('console-stamp')(console, '[HH:MM:ss.l]');

let config;
if (fs.existsSync("./config.json")) {
  config = require("./config.json");
} else {
  config = {
    token: process.env.TOKEN
  };
}

class Remix {
  constructor() {
    this.client = new Client();
    this.client.config = config;
    this.config = config;
    this.spotifyConfig = config.spotify;
    this.announceSong = config.songAnnouncements;
    this.presenceInterval = config.presenceInterval || 7000;

    this.settingsMgr = new SettingsManager();
    this.settingsMgr.loadDefaultsSync("./storage/defaults.json");

    this.client.on("ready", () => {
      let state = 0;
      let texts = config.presenceContents || ["Ping for prefix", "By RedTech | NoLogicAlan", "Servers: $serverCount"]
      setInterval(() => {
          this.client.users.edit({
          status: {
            text: texts[state].replace(/\$serverCount/g, this.client.servers.size),
            presence: "Online"
          },
        });
        if (state == texts.length - 1) {state = 0} else {state++}
      }, this.presenceInterval);

      console.log("Logged in as " + this.client.user.username);
    });

    this.handler = new CommandHandler(this.client, config.prefix);
    this.handler.setReplyHandler((t, msg) => {
      msg.reply({ content: "", embeds: [{
          type: "Text",
          description: t,
          colour: "#e9196c",
        }
      ]});
    });
    this.handler.setRequestCallback((...data) => this.request(...data));
    this.handler.setOnPing(msg => {
      let pref = this.handler.getPrefix(msg.channel.server_id);
      let m = this.iconem(msg.channel.server.name, "My prefix in this server is: `" + pref + "`", (msg.channel.server.icon) ? "https://autumn.revolt.chat/icons/" + msg.channel.server.icon._id : null);
      msg.reply(m)
    });
    const dir = path.join(__dirname, "commands");
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
    this.runnables = new Map();

    // load command files
    files.forEach(commandFile => {
      const file = path.join(dir, commandFile);
      const cData = require(file);
      const builder = (typeof cData.command == "function") ? cData.command.call(this) : cData.command;
      this.handler.addCommand(builder);
      if (cData.run) {
        this.runnables.set(builder.uid, cData.run);
        builder.subcommands.forEach(sub => {
          this.runnables.set(sub.uid, cData.run);
        });
      }
    });
    this.handler.on("run", (data) => {
      if (this.runnables.has(data.command.uid)) {
        this.runnables.get(data.command.uid).call(this, data.message, data);
      }
    });

    this.revoice = new Revoice(config.token);

    try {
      this.comHash = require('child_process')
          .execSync('git rev-parse --short HEAD', {cwd: __dirname})
          .toString().trim();
      this.comHashLong = require('child_process')
          .execSync('git rev-parse HEAD', {cwd: __dirname})
          .toString().trim();
    } catch(e) {
      console.log("Git comhash error");
      this.comHash = "Newest";
      this.comHashLong = null;
    }

    this.comLink = (this.comHashLong) ? "https://github.com/remix-bot/revolt/tree/" + this.comHashLong : "https://github.com/remix-bot/revolt";
    this.playerMap = new Map();
    this.currPort = -1;
    this.channels = [];
    this.freed = [];

    this.client.loginBot(config.token);

    return this;
  }
  request(d) {
    switch(d.type) {
      case "prefix":
        return this.settingsMgr.getServer(d.data.channel.server_id).get("prefix");
    }
  }
  getPlayer(message) {
    const user = this.revoice.getUser(message.author_id).user;
    if (!user) { message.reply(this.em("It doesn't look like we're in the same voice channel.")); return false }
    const cid = user.connectedTo;
    if (!cid) return false;
    return this.playerMap.get(cid);
  }
  getSettings(message) {
    const serverId = message.channel.server_id;
    return this.settingsMgr.getServer(serverId);
  }
  embedify(text = "", color = "#e9196c") {
    return {
      type: "Text",
      description: "" + text, // convert bools and numbers to strings
      colour: color,
    }
  }
  em(text) { // embedMessage
    return {
      content: " ",
      embeds: [this.embedify(text)],
    }
  }
  iconem(title, text, img) {
    let e = this.embedify(text);
    e.icon_url = img;
    e.title = title;
    return {
      content: " ",
      embeds: [e]
    }
  }
  prettifyMS(milliseconds) {
    const roundTowardsZero = milliseconds > 0 ? Math.floor : Math.ceil;

  	const parsed = {
  		days: roundTowardsZero(milliseconds / 86400000),
  		hours: roundTowardsZero(milliseconds / 3600000) % 24,
  		minutes: roundTowardsZero(milliseconds / 60000) % 60,
  		seconds: roundTowardsZero(milliseconds / 1000) % 60,
  		milliseconds: roundTowardsZero(milliseconds) % 1000,
  		microseconds: roundTowardsZero(milliseconds * 1000) % 1000,
  		nanoseconds: roundTowardsZero(milliseconds * 1e6) % 1000
  	};

    /*var selectNonEmpty = (p) => { // (way too complex) one liner to remove empty properties from an object
      return { ...Object.keys(p).filter(k => p[k]).map((k, i) => {
          return (i == 0) ? {[k]: p[k]} : {[k]: p[k], k: k}
        }).reduce((p, c) => ({ ...p, [c.k]: c[c.k]}))}
    }*/

    const units = {
      days: "d",
      hours: "h",
      minutes: "m",
      seconds: "s"
    }

    var result = "";
    for (let k in parsed) {
      if (!parsed[k] || !units[k]) continue;
      result += " " + parsed[k] + units[k];
    }
    return result.trim();
  }
}

const remix = new Remix();

// God, please forgive us, this is just to keep the bot online at all cost
process.on("unhandledRejection", (reason, p) => {
  console.log(" [Error_Handling] :: Unhandled Rejection/Catch");
  console.log(reason, p);
});
process.on("uncaughtException", (err, origin) => {
  console.log(" [Error_Handling] :: Uncaught Exception/Catch");
  console.log(err, origin);
});
process.on("uncaughtExceptionMonitor", (err, origin) => {
  console.log(" [Error_Handling] :: Uncaught Exception/Catch (MONITOR)");
  console.log(err, origin);
});
process.on("multipleResolves", (type, promise, reason) => {
  console.log(" [Error_Handling] :: Multiple Resolves");
  console.log(type, promise, reason);
});
