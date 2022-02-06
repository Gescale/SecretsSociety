var getUserById = require('./getUserById');
var extractPost = require('./extractPost');

module.exports = function iterStars(starsRefs){
    new Promise((resolve, reject) => {
        Promise.all(myStarsRefs.map(async function (star){
            var foundUser = await getUserById(star.userId);
            var post = await extractPost(star.userId, star.postId);
  resolve(post);
        })
)
    })
}