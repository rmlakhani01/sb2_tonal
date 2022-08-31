/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
define(['N/runtime', 'N/record'], function (runtime, record) {
  function execute(context) {
    try {
      let depositRecords = {}
      let inputData = JSON.parse(
        runtime
          .getCurrentScript()
          .getParameter({ name: 'custscript_input' }),
      )
      //   depositRecords.taxDeposit = taxDeposit(inputData)
      depositRecords.feeDeposit = feeDeposit(inputData)
      log.debug('Deposits Created', depositRecords)
    } catch (e) {
      log.debug('stack', e.stack)
    }
  }

  const taxDeposit = (inputData) => {
    try {
      let depositRecord = record.create({
        type: record.Type.DEPOSIT,
        isDynamic: true,
      })

      depositRecord.setValue({
        fieldId: 'account',
        value: inputData.paymentDetails[0].details.account,
      })

      depositRecord.setValue({
        fieldId: 'memo',
        value: inputData.woocommerceNumber,
      })

      depositRecord.setValue({
        fieldId: 'custbody3',
        value: inputData.woocommerceNumber,
      })

      depositRecord.setValue({
        fieldId: 'trandate',
        value: new Date(inputData.tranDate),
      })

      depositRecord.setValue({
        fieldId: 'custbody_created_from',
        value: inputData.customerDepositId,
      })

      depositRecord.selectNewLine({ sublistId: 'cashback' })
      depositRecord.setCurrentSublistValue({
        sublistId: 'cashback',
        fieldId: 'account',
        value: 122,
      })
      depositRecord.setCurrentSublistValue({
        sublistId: 'cashback',
        fieldId: 'amount',
        value:
          typeof inputData.tax === 'string'
            ? Math.abs(inputData.tax)
            : inputData.tax,
      })
      depositRecord.commitLine({ sublistId: 'cashback' })
      depositRecord.selectNewLine({ sublistId: 'cashback' })
      depositRecord.setCurrentSublistValue({
        sublistId: 'cashback',
        fieldId: 'account',
        value: 240,
      })
      depositRecord.setCurrentSublistValue({
        sublistId: 'cashback',
        fieldId: 'amount',
        value:
          typeof inputData.tax === 'string'
            ? -Math.abs(inputData.tax)
            : inputData.tax,
      })
      depositRecord.commitLine({ sublistId: 'cashback' })
      let depositId = depositRecord.save()
      return depositId
    } catch (e) {
      log.debug('stack', e.stack)
    }
  }

  const feeDeposit = (inputData) => {
    try {
      log.debug('deposit', inputData)
      let depositRecord = record.create({
        type: record.Type.DEPOSIT,
        isDynamic: true,
      })

      depositRecord.setValue({
        fieldId: 'account',
        value: inputData.paymentDetails[0].details.account,
      })

      depositRecord.setValue({
        fieldId: 'memo',
        value: inputData.woocommerceNumber,
      })

      depositRecord.setValue({
        fieldId: 'custbody3',
        value: inputData.woocommerceNumber,
      })

      depositRecord.setValue({
        fieldId: 'trandate',
        value: new Date(inputData.tranDate),
      })

      depositRecord.setValue({
        fieldId: 'custbody_created_from',
        value: inputData.customerDepositId,
      })

      depositRecord.selectNewLine({ sublistId: 'cashback' })
      depositRecord.setCurrentSublistValue({
        sublistId: 'cashback',
        fieldId: 'account',
        value: 122,
      })
      depositRecord.setCurrentSublistValue({
        sublistId: 'cashback',
        fieldId: 'amount',
        value:
          typeof inputData.paymentFee === 'string'
            ? Math.abs(inputData.paymentFee)
            : inputData.paymentFee,
      })
      depositRecord.commitLine({ sublistId: 'cashback' })
      depositRecord.selectNewLine({ sublistId: 'cashback' })
      depositRecord.setCurrentSublistValue({
        sublistId: 'cashback',
        fieldId: 'account',
        value: 240,
      })
      depositRecord.setCurrentSublistValue({
        sublistId: 'cashback',
        fieldId: 'amount',
        value:
          typeof inputData.paymentFee === 'string'
            ? -Math.abs(inputData.paymentFee)
            : inputData.paymentFee,
      })
      depositRecord.commitLine({ sublistId: 'cashback' })
      let depositId = depositRecord.save()
      return depositId
    } catch (e) {
      log.debug('stack', e.stack)
    }
  }

  return {
    execute: execute,
  }
})
