const axios = require('axios');
async function testAuthMe() {
    try {
        const res = await axios.get('https://scholarflow-api.onrender.com/api/auth/me');
        console.log(res.status);
    } catch(e) {
        if(e.response) {
            console.log("Status:", e.response.status);
            console.log("Body:", e.response.data);
            console.log("Headers:", e.response.headers['server']);
        }
    }
}
testAuthMe();
