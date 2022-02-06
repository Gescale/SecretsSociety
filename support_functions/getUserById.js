module.exports = function getUserById(id){
    let p = new Promise((resolve, reject) => {
        User.findById(req.params.userId, function(err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
            resolve(foundUser)
            } else {
            reject(new Error('Something went wrong, the user was not found!'))
            }
        }
        });
    })
}

// Tester Data
// var oneStar = {
//  userId : '61ec3e209303a9282c3cafdb',
//  postId: 1
// }