const BTCPayServerAPI = {
  async createInvoice(userId) {
    const fetch = (await import('node-fetch')).default; // Dynamic import

    const apiEndpoint = `/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'token ' + process.env.BTCPAY_API_KEY,
    };

    const payload = {
      metadata: {
        userId: userId,
      },
    };

    const response = await fetch(process.env.BTCPAY_SERVER_URL + apiEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`BTCPay API Error: ${errorData}`);
    }

    return await response.json();
  },

  async retrieveInvoices() {
    const fetch = (await import('node-fetch')).default; // Dynamic import

    const apiEndpoint = `/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'token ' + process.env.BTCPAY_API_KEY,
    };

    const response = await fetch(process.env.BTCPAY_SERVER_URL + apiEndpoint + '?take=20', {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log(errorData);
      throw new Error(`BTCPay API Error: ${response.statusText}`);
    }

    return await response.json();
  },

  async getInvoice(storeId, invoiceId) {
    const fetch = (await import('node-fetch')).default; // Dynamic import

    const apiEndpoint = `/api/v1/stores/${storeId}/invoices/${invoiceId}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'token ' + process.env.BTCPAY_API_KEY,
    };

    const response = await fetch(process.env.BTCPAY_SERVER_URL + apiEndpoint, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`BTCPay API Error: ${errorData}`);
    }

    return await response.json();
  },
};

module.exports = BTCPayServerAPI; // Exporting the API