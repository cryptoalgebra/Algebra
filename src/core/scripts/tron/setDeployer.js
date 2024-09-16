const tronbox = require("../../tronbox-config");

const tronWeb = tronbox.tronWeb.nile

async function main() {
    const contractAddress = "TBBocaEBHP4cYenZuPdsL7EnLTp58h9dsG";
    let contract = await tronWeb.contract().at(contractAddress);

    let txId = await contract.setDeployerAddress("418a84e232a99fb84c34af49d023005cf276b44583").send();
    console.log(
      `Check tx on the explorer: https://nile.tronscan.org/#/transaction/${txId}`
    );
}

main().then(() => {
    process.exit(0)
});