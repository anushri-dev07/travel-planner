require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({}, 'username email password createdAt');
    console.log('=== ALL REGISTERED USERS ===');
    console.log('');
    users.forEach((u, i) => {
        const pwPreview = u.password.startsWith('$2') ? '(bcrypt hashed)' : u.password;
        console.log(`${i+1}. Username: ${u.username}`);
        console.log(`   Email: ${u.email}`);
        console.log(`   Password: ${pwPreview}`);
        console.log(`   Created: ${u.createdAt}`);
        console.log('');
    });
    console.log(`Total: ${users.length} users`);
    await mongoose.disconnect();
})();
