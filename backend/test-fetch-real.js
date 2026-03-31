const jwt = require('jsonwebtoken');
const axios = require('axios');

async function testFetch() {
    try {
        const user = {
            id: '56c18118-9500-4ba6-9e8e-6d92640b63eb', // Dayne's ID
            email: 'waynepabillon667@gmail.com',
            name: 'Dayne Pabillon',
            role: 'member'
        };
        const token = jwt.sign(user, process.env.JWT_SECRET || 'skyflow-local-development-secret-key-12345', { expiresIn: '1y' });

        const url = 'https://scholarflow-api-1lce.onrender.com/api/analytics/overview';
        const orgId = 'c4c31d2e-b567-4d86-b52f-1524b6e35e1e'; // ScholarSync org ID

        console.log("Fetching from:", url);
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-organization-id': orgId
            }
        });

        console.log("Status:", response.status);
        console.log("Data:", JSON.stringify(response.data, null, 2));

    } catch(e) {
        console.error("HTTP Request Failed:");
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", e.response.data);
            console.error("Headers:", e.response.headers['server']);
        } else {
            console.error(e.message);
        }
    }
}
testFetch();
