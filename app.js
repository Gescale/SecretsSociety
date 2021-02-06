//jshint esversion:6

require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const session = require("cookie-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(session({
  secret: "we are on!",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());



mongoose.connect("mongodb+srv://admin-gesy:realjembure@soft-mambo.mdxof.mongodb.net/userDB?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, )
  .catch(err => {
    console.error(err.stack)
    process.exit(1)
  })

  .then(async () => {
    mongoose.set("useCreateIndex", true);

    const Schema = mongoose.Schema;
    const userSchema = new Schema({
      email: String,
      password: String,
      googleId: String,
      secrets: [String]
    });

    userSchema.plugin(passportLocalMongoose);
    userSchema.plugin(findOrCreate);

    const User = mongoose.model("User", userSchema);

    passport.use(User.createStrategy());

    passport.serializeUser(function(user, done) {
      done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
      User.findById(id, function(err, user) {
        done(err, user);
      });
    });

    passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "https://our-secrets.herokuapp.com/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
      },
      function(resolve, reject, accessToken, refreshToken, profile, cb) {
        if(profile){
          User.findOrCreate({
            console.log(profile.id)
            googleId: profile.id
          }, function(err, user) {
            return cb(err, user);
          });
        } else {
          console.log("User undefined in GoogleStrategyPassport", reject);
        }
      }
    ));

    app.get("/", (req, res) => {
      res.render("home");
    });

    app.get("/auth/google",
      passport.authenticate("google", {
        scope: ["profile", "email"]
      })
    );

    app.get("/auth/google/secrets",
      passport.authenticate("google", {
        failureRedirect: "/login"
      }),
      function(req, res) {
        // Successfull authentication redirect to secrets
        res.redirect("/secrets");
      });

    app.get("/login", (req, res) => {
      res.render("login");
    });

    app.get("/register", (req, res) => {
      res.render("register");
    });

    app.get("/secrets", function(req, res) {
      User.find(/*{secrets: ['$in']},*/
      function(err, foundUsers) {
        if (err) {
          console.log(err);
        } else {
          if (foundUsers) {
            console.log(foundUsers);
            res.render("secrets", {
              usersWithSecrets: foundUsers
            });
          }
        }
      });
    });

    app.get("/logout", function(req, res) {
      req.logout();
      res.redirect("/");
    });

    app.get("/submit", function(req, res) {
      if (req.isAuthenticated()) {
        res.render("submit");
      } else {
        res.redirect("/login");
      }
    });

    app.post("/register", function(req, res) {

      User.register({
        username: req.body.username
      }, req.body.password, function(err, user) {
        if (err) {
          console.log(err);
          res.redirect("/register");
        } else {
          passport.authenticate("local")(req, res, function() {
            res.redirect("/secrets");
          });
        }
      });
    });

    app.post("/send", function(req, res) {
      const submittedSecret = req.body.secret;
      User.findById(req.user.id, function(err, foundUser) {
        if (err) {
          console.log(err);
        } else {
          if (foundUser) {
            // foundUser.secrets = submittedSecret;
            foundUser.secrets.push(submittedSecret);
            foundUser.save(function() {
              res.redirect("/secrets");
            });
          } else {
            console.log("not found");
          }
        }
      });
    });

    app.post("/login", function(req, res) {

      const user = new User({
        username: req.body.username,
        password: req.body.password
      });

      req.login(user, function(err) {
        if (err) {
          console.log(err);
        } else {
          passport.authenticate("local")(req, res, function(err) {
            res.redirect("/secrets");
          });
        }
      });
    });

    app.listen(process.env.PORT || 3000, () => {
      console.log("Server running on port 3000");
    });
  });
