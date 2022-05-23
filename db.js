const Sequelize = require('sequelize');
const { STRING } = Sequelize;
const config = {
  logging: false,
};
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(process.env.DATABASE_URL || 'postgres://localhost/acme_db', config);

const User = conn.define('user', {
  username: STRING,
  password: STRING,
});

const Note = conn.define('note', {
  text: STRING,
});

Note.belongsTo(User);
User.hasMany(Note);

User.byToken = async (token) => {
  try {
    const userToken = jwt.verify(token, process.env.JWT);
    if (userToken) {
      const user = await User.findByPk(userToken.userId);
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.beforeCreate(async (user) => {
  const hashedPassword = await bcrypt.hash(user.password, 5);
  user.password = hashedPassword;
});

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });
  const correct = await bcrypt.compare(password, user.password);
  if (correct) {
    const token = jwt.sign({ userId: user.id }, process.env.JWT);
    return token;
  }
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw' },
    { username: 'moe', password: 'moe_pw' },
    { username: 'larry', password: 'larry_pw' },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );
  const notes = [{ text: 'note1' }, { text: 'note2' }, { text: 'note3' }, { text: 'note4' }];

  const [note1, note2, note3, note4] = await Promise.all(notes.map((note) => Note.create(note)));

  await lucy.addNotes([note1, note4]);
  await moe.addNotes(note2);
  await larry.addNotes(note3);

  console.log(User.prototype);
  return {
    users: {
      lucy,
      moe,
      larry,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
