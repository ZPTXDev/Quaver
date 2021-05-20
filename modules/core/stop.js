module.exports.commands = ["stop"];
module.exports.usage = "%cmd%";
module.exports.description = "Stop Quaver gracefully.";
module.exports.action = function (details) {
    const settings = require("../../main.js").settings;
    const managers = settings.get("managers");
    if (!managers.includes(details["message"].author.id)) {
        return "manager";
    }
    console.log("[!] Gracefully stopping Quaver")
    details["message"].channel.createMessage({
        messageReference: {messageID: details["message"].id},
        embed: {
            description: "Gracefully stopping Quaver",
            color: 0xf39bff
        }
    }).finally(() => {
        process.exit(0);
    });
    return true;
}