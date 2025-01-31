const async = require('async');

const { getLogger } = require('./log');

const logger = getLogger('util');

// 兜底，保证进程不会挂
process.on('uncaughtException', async (error) => {
    logger.error(`Catch Process Exception: ${error}`);
});


async function mapRun(dataList, executeFunc, queueSize=50) {
    logger.info(`并行执行任务: 队列数量=${queueSize}, 数据总量=${dataList.length}, 函数名称=${executeFunc}`);
    dataList.map((item, idx) => {
        item.idx = idx;
    })
    const results = []
    await async.mapLimit(dataList, queueSize, async (data) => {
        try {
            results.push(await executeFunc(data));
        } catch(e) {
            logger.error(`执行时遇到未捕获异常: ${e}, 原始数据为: ${JSON.stringify(data)}`);
        }
    });
    return results;
}

async function wait(t = 1000) {
    await new Promise(resolve => {setTimeout(() => resolve(), t);})
}

module.exports = {
    mapRun,
    wait
}
