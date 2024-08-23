const util = require("../util.js");

async function main() {
  await util.sendMail("yang.gu@intel.com", "test", "test");
}

main();
