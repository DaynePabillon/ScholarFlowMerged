const jwt = require('jsonwebtoken'); // Need to install jsonwebtoken? the backend has it!
const axios = require('axios');
const fs = require('fs');

async function testFetch() {
    try {
        // 1. Generate a valid token for Dayne
        const user = {
            id: '56c18118-9500-4ba6-9e8e-6d92640b63eb',
            email: 'waynepabillon667@gmail.com',
            name: 'Dayne Pabillon',
            role: 'member'
        };
        const token = jwt.sign(user, process.env.JWT_SECRET || 'skyflow-local-development-secret-key-12345', { expiresIn: '1y' });

        console.log("Token generated:", token.substring(0, 20) + "...");

        // 2. Make the HTTP request
        // The deployed URL:
        const url = 'https://scholarflow-api.onrender.com/api/analytics/overview';
        const orgId = 'c4c31d2e-b567-4d86-b52f-1524b6e35e1e'; // ScholarSync org

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
        } else {
            console.error(e.message);
        }
    }
}
testFetch();
