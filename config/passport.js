const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const mongoose = require("mongoose");
const keys = require("./keys");
const User = mongoose.model("User");

module.exports = function (passport) {
    // JWT Strategy
    passport.use(
        new JwtStrategy(
            {
                jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
                secretOrKey: keys.secretOrKey
            },
            async (jwtPayload, done) => {
                try {
                    const user = await User.findById(jwtPayload.id);
                    if (user) {
                        done(null, user);
                    } else {
                        done(null, false);
                    }
                } catch (err) {
                    done(err, false);
                }
            }
        )
    );
};  