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

mongoose.connect("mongodb://localhost:27017/userDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .catch(err => {
    console.error(err.stack)
    process.exit(1)
  })

  .then(async () => {
    mongoose.set("useCreateIndex", true);

    const Schema = mongoose.Schema;

    const starSchema = new Schema({
      userId: String,
      postId: String
    });

    const secretsSchema = new Schema({
      secret: String,
      likes: [String]
    });

    const userSchema = new Schema({
      email: String,
      password: String,
      googleId: String,
      stars: [starSchema],
      secrets: [secretsSchema]
    });

    userSchema.plugin(passportLocalMongoose);
    userSchema.plugin(findOrCreate);

    const User = mongoose.model("User", userSchema);




//////////////////////////   Passport Authentication  ///////////////////////////////////////////////
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
        callbackURL: "https://secrets-society.herokuapp.com/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
      },
      function(resolve, reject, accessToken, refreshToken, profile, cb) {
        if(profile){
          User.findOrCreate({
            googleId: profile.id
          }, function(err, user) {
            return cb(err, user);
          });
        } else {
          console.log("User undefined in GoogleStrategyPassport", reject);
        }
      }
    ));


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
      }
    );


    ////////////////////////////   Basic Gets      ///////////////////////
    app.get("/", (req, res) => {
      res.render("home");
    });


    app.get("/secrets", function(req, res) {
      if(req.isAuthenticated()){
        User.find(/*{secrets: ['$in']},*/
        function(err, foundUsers) {
          if (err) {
            console.log(err);
          } else {
            if (foundUsers) {
              // Load every Secret into one new Array
              let newArray = [];
              foundUsers.forEach((oneUser)=>{
                oneUser.secrets.forEach((secret, id) => {
                  newArray.push([oneUser.id, secret, id])
                })
              })

              // Shuffle the Array
              // function shuffleArray(array) {
              //   for (let i = array.length - 1; i > 0; i--) {
              //     const j = Math.floor(Math.random() * (i + 1));
              //     [array[i], array[j]] = [array[j], array[i]];
              //   }
              // }

              function shuffle(array) {
                array.sort(() => Math.random() - 0.5);
              }

              let shuffledArray = shuffle(newArray);
              console.log(shuffledArray);

              res.render("secrets", {
                usersWithSecrets: foundUsers,
                myId : req.user.id
              });
            }
          }
        });
      } else {
        res.redirect("/login");
      }
    });

    app.get("/user/:userId", function(req, res) {
      if(req.isAuthenticated()){
        User.findById(req.user.id,
        function(err, foundUser) {
          if (err) {
            console.log(err);
          } else {
            if (foundUser) {
              res.render("secrets", {
                usersWithSecrets: [foundUser],
                myId : req.user.id
              });
            }
          }
        });
      } else {
        res.redirect("/login");
      }
    });


    app.get("/submit", function(req, res) {
      if (req.isAuthenticated()) {
        res.render("submit");
      } else {
        res.redirect("/login");
      }
    });

    //////////////////////////   Secrets  Submit   ///////////////////////////////////////////////

    

    app.post("/send", function(req, res) {
      const submittedSecret = {
        secret: req.body.secret,
        likes: []
      };
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



    ///////////////////////////////////// Login And Logout  /////////////////////////////////////////

    app.get("/login", (req, res) => {
      res.render("login");
    });


    app.get("/register", (req, res) => {
      res.render("register");
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


    app.get("/logout", function(req, res) {
      req.logout();
      res.redirect("/");
    });


/////////////////////////////////////////// Likes ////////////////////////////////////////////////


    app.get("/like/:userId/:postId", function(req, res) {
      User.findById(req.params.userId, function(err, foundUser) {
        if (err) {
          console.log(err);
        } else {
          if (foundUser) {
            foundUser.secrets[req.params.postId].likes.push(req.user.id);
            foundUser.save(function() {
              res.redirect("/secrets");
            });
          } else {
            console.log("not found");
          }
        }
      });
    });


// //////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////              STARS           ////////////////////////////////////////


    app.get("/star/:userId/:postId", function(req, res) {
      User.findById(req.user.id, function(err, foundUser) {
        if (err) {
          console.log(err);
        } else {
          if (foundUser) {
            // foundUser.secrets = submittedSecret;
            const star = {
              userId: req.params.userId,
              postId: req.params.postId
            };
            foundUser.stars.push(star);
            foundUser.save(function() {
              res.redirect("/secrets");
            });
          } else {
            console.log("not found");
          }
        }
      });
    });

// //////////////////////////////   Me    //////////////////////////////////////////////////////////////

    app.get("/me/stars/", function(req, res) {
      if(req.isAuthenticated()){
        const myStarsRefs = req.user.stars;
        // const secretKeeper = [User.ObjectId('61e1fcf25794ec2780d4c3fe'), User.ObjectId('61e1fa4329fb443de8b4ab80'), User.ObjectId('61e1f9bc9bbbc1150082d73f')];

        myStarsRefs.map(function (star){
          User.findById("61ec3e319303a9282c3cafdc", function(err, response){
            if(response){
              console.log("Response : ", response, "Error : ", err);
              // res.render("my_stars", {
              //   actualSecrets: [response]
              // });
            } else {
              console.log("Response : ", response, "Error : ", err);
            }
          })
        });
      } else {
        res.redirect("/login");
      }
    });


    app.get("/me/posts/delete/:postId", function(req, res) {
      User.findById( req.user.id , function(err, foundUser){
        if(foundUser){
          foundUser.secrets.splice(req.params.postId, 1);
          foundUser.save(function() {
            res.redirect("/me/posts");
          });
        } else {
          console.log(err);
        }
      });
    });

    app.get("/me/posts", function(req, res){
      res.render("my_posts", {usersWithSecrets: [req.user]});
    })



//////////////////////////////// The Code that drove me crazy //////////////////////////////////////////////

// app.get("/me/stars/", function(req, res) {
//   if(req.isAuthenticated()){
//     var myStarsRefs = req.user.stars;
//     let starsArr = [];


//     myStarsRefs.map(oneStar => {
//       User.findById(oneStar.userId, async function(err, foundUser) {
//         if(foundUser){
//           starsArr.push(foundUser.secrets[oneStar.postId]);
//         } else {
//           console.log(err);
//         }
//       })

//       console.log(starsArr);
//     })   

//     setTimeout(function(){
//       res.render("my_stars", {
//         actualSecrets: starsArr
//       });
//     },1000); //delay is in milliseconds

//   } else {
//     res.redirect("/login");
//   }
// });

////////////////////////////////////////////////////////////////////////////////////////////////////////////

    app.listen(process.env.PORT || 3000, () => {
      console.log("Server running on port 3000");
    });
});
