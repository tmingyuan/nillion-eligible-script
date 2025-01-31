const fs = require('fs').promises;
const fsSync = require('fs');
const csvStringify = require('csv-stringify');
const csvParser = require('csv-parser');



async function writeCsvFile(filePath, datas) {
    return await new Promise((resolve, reject) => {
        csvStringify.stringify(datas, {header: true}, async (err, output) => {
            await fs.writeFile(filePath, output);
            resolve('')
        })
    })
}
async function readCsvFile(filePath) {
    return await new Promise((resolve, reject) => {
        const results = []
        fsSync.createReadStream(filePath)
          .pipe(csvParser())
          .on('data', (data) => {
              results.push(data);
          })
          .on('end', () => {
              resolve(results)
          });
    })
}


module.exports = {
    readCsvFile,
    writeCsvFile,
};
