const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const isProd = process.env.NODE_ENV === 'production';

console.warn('\x1b[31m%s\x1b[0m', 'WARNING: You are about to completely reset the database.');
console.warn('\x1b[31m%s\x1b[0m', 'This action will DESTROY ALL DATA in the database.');

if (isProd) {
    console.error('\x1b[41m\x1b[37m%s\x1b[0m', ' CRITICAL: YOU ARE IN A PRODUCTION ENVIRONMENT! ');
}

rl.question('Are you absolutely sure you want to proceed? Type "YES" to confirm: ', (answer) => {
    if (answer === 'YES') {
        console.log('Resetting the database...');
        try {
            // Using prisma db push --force-reset to drop and recreate the schema
            execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
            console.log('\x1b[32m%s\x1b[0m', 'Database reset successful.');
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', 'Failed to reset the database.');
            process.exit(1);
        }
    } else {
        console.log('Aborted. No changes were made.');
    }
    rl.close();
});
