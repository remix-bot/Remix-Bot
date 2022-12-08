const { CommandBuilder } = require("../Commands.js");

module.exports = {
  command: new CommandBuilder()
    .setName("skip")
    .setDescription("Skip the current playing song."),
  run: function(message) {
    const p = this.getPlayer(message);
    if (!p) return;
    let res = p.skip() || `:white_check_mark: Song skipped!`;
    message.channel.sendMessage(this.em(res));
  }
}
