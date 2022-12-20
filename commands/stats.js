const { CommandBuilder } = require("../Commands.js");

module.exports = {
  command: new CommandBuilder()
    .setName("stats")
    .setDescription("Display stats about the bot like the uptime."),
  run: function(message) {
    const prettyMilliseconds = require("pretty-ms");
    const reason = (this.config.restart) ? ":screwdriver: Cause for last Restart: _" + this.config.restart + "_\n": "";
    message.channel.sendMessage({
      content: " ",
      embeds: [ this.embedify(`__**Stats:**__\n\n⌚️ Uptime: \`${prettyMilliseconds(Math.round(process.uptime()) * 1000)}\`\n${reason}:open_file_folder: Server Count: \`${this.client.servers.size}\`\n:mega: Player Count: \`${this.revoice.connections.size}\`\n🏓 Ping: \`${this.client.websocket.ping}ms\``)],
    });
  }
}
