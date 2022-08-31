/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
define(['N/search', 'N/record', 'N/task'], function (
  search,
  record,
  task,
) {
  function execute(context) {
    try {
      const carriers = ['Extron', 'Gilbert-FG']

      const transferOrders = getTransferOrders()
      for (let i = 0; i < carriers.length; i++) {
        let orders = transferOrders.filter(
          (order) => order.location === carriers[i],
        )
        if (orders && orders.length > 0) {
          if (orders[0].location === 'Extron') {
            let mrTask = task.create({
              taskType: task.TaskType.MAP_REDUCE,
            })
            mrTask.scriptId = 'customscript_3pl_order_files'
            mrTask.deployementId = 'customdeploy_extron_files'
            mrTask.params = {
              custscript_result_set: orders,
            }
            let taskId = mrTask.submit()
            log.debug('taskId: ' + taskId + 'Extron')
          }

          if (orders[0].location === 'Gilbert-FG') {
            let mrTask = task.create({
              taskType: task.TaskType.MAP_REDUCE,
            })
            mrTask.scriptId = 'customscript_3pl_order_files'
            mrTask.deployementId = 'customdeploy_gilbert_files'
            mrTask.params = {
              custscript_result_set: orders,
            }
            let taskId = mrTask.submit()
            log.debug('taskId: ' + taskId + 'Gilbert')
          }
        }
      }
    } catch (error) {
      log.debug('error getting transfer orders', error)
    }
  }
  const getTransferOrders = () => {
    const transferOrders = []
    search
      .create({
        type: 'transaction',
        filters: [
          {
            name: 'type',
            operator: search.Operator.ANYOF,
            values: 'TrnfrOrd',
          },
          {
            name: 'mainline',
            operator: search.Operator.IS,
            values: true,
          },
          {
            name: 'status',
            operator: search.Operator.ANYOF,
            values: 'TrnfrOrd:B',
          },
        ],
        columns: [{ name: 'internalid' }, { name: 'location' }],
      })
      .run()
      .each((result) => {
        let order = {
          id: result.getValue({ name: 'internalid' }),
          location: result
            .getText({ name: 'location' })
            .split(':')[0]
            .replace(/\s+/g, ''),
        }
        transferOrders.push(order)
        return true
      })

    return transferOrders
  }

  return {
    execute: execute,
  }
})
