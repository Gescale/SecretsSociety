module.exports = function extractPost(user, postId){
    new Promise((resolve, reject) => {
        resolve(user.secrets[postId])
    })
}