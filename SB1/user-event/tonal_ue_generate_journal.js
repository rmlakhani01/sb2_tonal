/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search', 'N/record', 'N/runtime'], function (
  search,
  record,
  runtime,
) {
  const afterSubmit = (context) => {
    if (context.type === 'create') {
      const order = fetchCustomerDeposits(
        context.newRecord.getValue({
          fieldId: 'createdfrom',
        }),
      )
      generateJournalEntry(order)
    }
  }

  const fetchCustomerDeposits = (soId) => {
    let order = {}
    search
      .create({
        type: search.Type.TRANSACTION,
        filters: [
          {
            name: 'type',
            operator: search.Operator.ANYOF,
            values: ['CustDep'],
          },
          {
            name: 'salesorder',
            operator: search.Operator.ANYOF,
            values: [soId],
          },
        ],
        columns: [
          {
            name: 'custbody_payment_fee',
          },
          {
            name: 'memo',
          },
          {
            name: 'internalid',
          },
        ],
      })
      .run()
      .each((customerDeposit) => {
        ;(order.custDepId = customerDeposit.getValue({
          name: 'internalid',
        })),
          (order.fee = customerDeposit.getValue({
            name: 'custbody_payment_fee',
          })),
          (order.memo = customerDeposit.getValue({ name: 'memo' }))
        return true
      })
    return order
  }

  const generateJournalEntry = (details) => {
    let debit = runtime
      .getCurrentScript()
      .getParameter({ name: 'custscript_affirm_processing_fee' })
    let credit = runtime
      .getCurrentScript()
      .getParameter({ name: 'custscript_deferred_affirm_fee' })

    let journalRecord = record.create({
      type: record.Type.JOURNAL_ENTRY,
      isDynamic: true,
    })

    journalRecord.setValue({ fieldId: 'approvalstatus', value: 2 })
    journalRecord.setValue({ fieldId: 'subsidiary', value: 1 })
    journalRecord.setValue({ fieldId: 'memo', value: details.memo })
    journalRecord.insertLine({ sublistId: 'line', line: 0 })
    journalRecord.setCurrentSublistValue({
      sublistId: 'line',
      fieldId: 'account',
      value: debit,
    })
    journalRecord.setCurrentSublistValue({
      sublistId: 'line',
      fieldId: 'debit',
      value: details.fee,
    })
    journalRecord.commitLine({ sublistId: 'line' })
    journalRecord.insertLine({ sublistId: 'line', line: 1 })
    journalRecord.setCurrentSublistValue({
      sublistId: 'line',
      fieldId: 'account',
      value: credit,
    })
    journalRecord.setCurrentSublistValue({
      sublistId: 'line',
      fieldId: 'credit',
      value: details.fee,
    })
    journalRecord.commitLine({ sublistId: 'line' })

    let journalId = journalRecord.save()
    if (journalId) {
      record.submitFields({
        type: record.Type.CUSTOMER_DEPOSIT,
        id: details.custDepId,
        values: {
          custbody_merchant_fee_je_2: journalId,
        },
      })
    }
  }
  return {
    afterSubmit: afterSubmit,
  }
})
