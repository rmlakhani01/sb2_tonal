/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define([
  'N/search',
  'N/record',
  'N/runtime',
  './lib_retry_mechanism',
], function (search, record, runtime, libRetry) {
  const afterSubmit = (context) => {
    if (
      context.type === 'create' ||
      (runtime.executionContext === runtime.ContextType.MAP_REDUCE &&
        runtime.getCurrentScript().id === 'customscript1470')
    ) {
      const order = fetchCustomerDeposits(
        context.newRecord.getValue({
          fieldId: 'createdfrom',
        }),
      )
      if (order.paymentMethod === '7') {
        let recordObject = generateJournalEntry(
          order,
          context.newRecord.id,
        )
        if (recordObject.isSuccess === true) {
          updateItemFulfillment(context.newRecord)
        }

        if (recordObject.isSuccess === false) {
          libRetry.updateTransaction(recordObject)
        }
      }
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
          {
            name: 'datecreated',
            join: 'createdfrom',
            operator: search.Operator.ONORAFTER,
            values: ['11/01/2022 12:00 am'],
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
          {
            name: 'paymentmethod',
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
          (order.memo = customerDeposit.getValue({ name: 'memo' })),
          (order.paymentMethod = customerDeposit.getValue({
            name: 'paymentmethod',
          }))
        return true
      })
    return order
  }

  const generateJournalEntry = (details, itemFulfilId) => {
    try {
      let recordObject = {}
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

      journalRecord.setValue({
        fieldId: 'externalid',
        value: 'OJE_' + details.memo,
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
        recordObject.isSuccess = true
        recordObject.sourceRecordType = record.Type.ITEM_FULFILLMENT
        recordObject.sourceRecordId = itemFulfilId
        recordObject.destinationRecordType = record.Type.JOURNAL_ENTRY
        recordObject.destinationRecordId = journalId

        record.submitFields({
          type: record.Type.CUSTOMER_DEPOSIT,
          id: details.custDepId,
          values: {
            custbody_merchant_fee_je_2: journalId,
          },
        })

        return recordObject
      }
    } catch (e) {
      let recordObject = {
        isSuccess: false,
        errors: e,
        sourceRecordType: record.Type.ITEM_FULFILLMENT,
        sourceRecordId: itemFulfilId,
        destinationRecordType: record.Type.JOURNAL_ENTRY,
        destinationRecordId: null,
      }
      return recordObject
    }
  }

  const updateItemFulfillment = (newRecord) => {
    let itemFulfil = record.load({
      type: newRecord.type,
      id: newRecord.id,
    })

    itemFulfil.setValue({
      fieldId: 'custbody_processed_dt',
      value: new Date(),
    })

    itemFulfil.setValue({
      fieldId: 'custbody_error_description',
      value: '',
    })
    itemFulfil.setValue({
      fieldId: 'custbody_trigger_reprocess',
      value: false,
    })

    itemFulfil.save()
  }
  return {
    afterSubmit: afterSubmit,
  }
})
