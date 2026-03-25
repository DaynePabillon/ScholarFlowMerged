import pool from './src/config/database'

async function updateRole() {
  try {
    // Find the user
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = 'waynepabillon@gmail.com'"
    )
    
    if (userResult.rows.length === 0) {
      console.log('User not found')
      return
    }
    
    const userId = userResult.rows[0].id
    console.log('Found user:', userId)
    
    // Update role to manager
    const updateResult = await pool.query(
      "UPDATE organization_members SET role = 'manager' WHERE user_id = $1 RETURNING *",
      [userId]
    )
    
    console.log('Updated rows:', updateResult.rowCount)
    console.log('Result:', updateResult.rows)
    
    // Verify
    const verifyResult = await pool.query(`
      SELECT u.email, om.role, o.name as org_name 
      FROM organization_members om 
      JOIN users u ON om.user_id = u.id 
      JOIN organizations o ON om.organization_id = o.id 
      WHERE u.email = 'waynepabillon@gmail.com'
    `)
    
    console.log('\\nCurrent roles for waynepabillon@gmail.com:')
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.org_name}: ${row.role}`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await pool.end()
  }
}

updateRole()
