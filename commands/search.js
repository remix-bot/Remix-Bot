const { CommandBuilder } = require("../Commands.js");

function awaitMessage(msg, count, player) {
  const oid = this.observeUser(msg.author_id, msg.channel_id, (m) => {
    if (m.content.trim().toLowerCase() == "x") {
      this.unobserveUser(oid);
      return m.reply(this.em("Cancelled!", m));
    }
    let c = parseInt(m.content.trim().replace(/\./g, ""));
    if (isNaN(c)) m.reply(this.em("Invalid number! (Send 'x' to cancel)", m));
    if (c < 0 || c > count) return m.reply(this.em("Index out of range! (`1 - " + count + "`)", m));
    let v = player.playResult(msg.author_id, c - 1);
    m.reply(this.em((typeof v == "string") ? v : `Added [${v.title}](${v.url}) to the queue!`, m));
    this.unobserveUser(oid);
  });
}

module.exports = {
  command: new CommandBuilder()
    .setName("search")
    .setDescription("Display the search results for a given query")
    .addTextOption(o =>
      o.setName("query")
        .setDescription("The query to search for.")
        .setRequired(true)
    ),
  run: function(msg, data) {
    const p = this.getPlayer(msg);
    if (!p) return;
    let query = data.get("query").value;
    msg.reply(this.em("Loading results...", msg)).then(async m => {
      let res = await p.fetchResults(query, msg.author_id);
      m.edit(this.em(res.m, msg));
      awaitMessage.call(this, msg, res.count, p);
    });
  }
}
