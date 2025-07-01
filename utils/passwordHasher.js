const bcrypt = require('bcryptjs');

const saltRounds = 10;

const hashPassword = async (password) => {
    try {
        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw new Error('Could not hash password');
    }
};

const comparePassword = async (plainPassword, hashedPassword) => {
    try {
        const result = await bcrypt.compare(plainPassword, hashedPassword);
        return result;
    } catch (error) {
        console.error('Error comparing password:', error);
        throw new Error('Could not compare password');
    }
};

module.exports = {
    hashPassword,
    comparePassword
};