/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
define(['N/search', 'N/record'], function (search, record) {
  function execute(context) {
    try {
      search
        .create({
          type: 'customrecord_lm_coverage',
          filters: [
            {
              name: 'custrecord_customer_zip',
              operator: search.Operator.CONTAINS,
              values: "'",
            },
          ],
          columns: [{ name: 'internalid' }],
        })
        .run()
        .each((rec) => {
          log.debug('record', rec)
          var custrecord = record.load({
            type: 'customrecord_lm_coverage',
            id: rec.getValue({ name: 'internalid' }),
          })

          var input = custrecord.getValue({
            fieldId: 'custrecord_customer_zip',
          })
          var output = input.replace(/\D/g, '')

          custrecord.setValue({
            fieldId: 'custrecord_customer_zip',
            value: output,
          })
          custrecord.save()
          return true
        })
    } catch (error) {
      log.debug('error', error)
      log.debug('message', error.message)
    }
  }

  return {
    execute: execute,
  }
})
