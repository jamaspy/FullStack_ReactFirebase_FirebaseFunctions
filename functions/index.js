const functions = require("firebase-functions");
const admin = require("firebase-admin");
const firebase = require("firebase");
const app = require("express")();
admin.initializeApp();

const config = {
	apiKey: "AIzaSyBBWzSFeDALPFG7Doe1Y62z834kYoV2POU",
	authDomain: "socialape-a8077.firebaseapp.com",
	databaseURL: "https://socialape-a8077.firebaseio.com",
	projectId: "socialape-a8077",
	storageBucket: "socialape-a8077.appspot.com",
	messagingSenderId: "453461361078",
	appId: "1:453461361078:web:bb538747c1461267"
};

firebase.initializeApp(config);
const db = admin.firestore();


// GET ALL SCREAMS
app.get("/screams", (request, response) => {
	db.collection("screams")
		.orderBy("createdAt", "desc")
		.get()
		.then(data => {
			let screams = [];
			data.forEach(doc => {
				screams.push({
					screamId: doc.id,
					body: doc.data().body,
					userHandle: doc.data().userHandle,
					createdAt: doc.data().createdAt
				});
			});
			return response.json(screams);
		})
		.catch(error => console.error(error));
});



// eslint-disable-next-line consistent-return
const FBAuth = (req, res, next) => {
    let idToken
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ')
      ) {
        idToken = req.headers.authorization.split('Bearer ')[1];
      } else {
        console.error('No token found');
        return res.status(403).json({ error: 'Unauthorized' });
      }

    admin.auth().verifyIdToken(idToken)
    .then((decodedToken) => {
        req.user = decodedToken;
        return db
          .collection('users')
          .where('userId', '==', req.user.uid)
          .limit(1)
          .get();
        })
        .then((data) => {
            req.user.handle = data.docs[0].data().handle;

            return next();
          })
      
        .catch((err) => {
            console.error('Error While Verifing Token', err)
            return res.status(403).json(err)
        })
}

// POST ONE SCREAM
// eslint-disable-next-line consistent-return
app.post("/scream", FBAuth, (request, response) => {
    
    if(request.body.body.trim() === ''){
        return response.status(400).json({body: "Body must not be empty"})
    }

    const newScream = {
		body: request.body.body,
		userHandle: request.body.handle,
		createdAt: new Date().toISOString()
    };
    
	db.collection("screams")
		.add(newScream)
		// eslint-disable-next-line promise/always-return
		.then(doc => {
			response.json({ message: `${doc.id}` });
		})
		.catch(error => {
			response.status(500).json({ error: `something went wrong` });
			console.log(error);
		});
});

const isEmpty = (string) => {
    if(string.trim() === '') return true
    else return false
}

const isEmail = (email) => {
    // eslint-disable-next-line no-useless-escape
    const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(regEx)) return true;
    else return false;
}

//Signup Route
// eslint-disable-next-line consistent-return
app.post("/signup", (request, response) => {
	const newUser = {
		email: request.body.email,
		password: request.body.password,
		confirmPassword: request.body.confirmPassword,
		handle: request.body.handle
    };

    //Input Validation
    let errors = {}
    
    if(isEmpty(newUser.email)) {
        errors.email = "Must Not Be Empty"
    }else if(!isEmail(newUser.email)){
        errors.email = "Must Be A Valid Email Address"
    }

    if(isEmpty(newUser.password)) errors.password = "Please Enter A Password"
    if(newUser.password !== newUser.confirmPassword) errors.confirmPassword = "Password Must Be The Same"
    if(isEmpty(newUser.handle)) errors.handle = "Please Enter A Handle"

    if(Object.keys(errors).length > 0) return response.status(400).json(errors)

	let token, userId;
	db.doc(`/users/${newUser.handle}`)
		.get()
		.then(doc => {
			if (doc.exists) {
				return response
					.status(400)
					.json({ handle: `this handle is already taken` });
			} else {
				return firebase
					.auth()
					.createUserWithEmailAndPassword(newUser.email, newUser.password);
			}
		})
		.then(data => {
			userId = data.user.uid;
			return data.user.getIdToken();
		})
		.then(idToken => {
			token = idToken;
			const userCredntials = {
				handle: newUser.handle,
				email: newUser.email,
				createdAt: new Date().toISOString(),
				userId: userId
			};
			return db.doc(`/users/${newUser.handle}`).set(userCredntials);
		})
		.then(() => {
			return response.status(201).json({ token });
		})
		.catch(error => {
			console.error(error);
			if (error.code === "auth/email-already-in-use") {
				return response
					.status(400)
					.json({ email: "Email is already in use. Login." });
			} else {
				return response.status(500).json({ error: `${error.code} SOmething` });
			}
		});
});

// eslint-disable-next-line consistent-return
app.post(`/login`, (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    let errors = {}
    if (isEmpty(user.email)) errors.email = 'Must not be empty';
    if (isEmpty(user.password)) errors.password = 'Must not be empty';
    
    Object.keys(errors).length === 0 ? true : false;

    firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then((data) => {
        return data.user.getIdToken();
    })
    .then((token) => {
        return res.json({ token })
    })
    .catch((err) => {
        console.error(err);
        if(err.code === "auth/wrong-password"){
            return res.status(403).json({general: 'Wroing Credentials Please Try Again'})
        }else{
        return res.status(500).json({ error: err.code })
        }
    });
});

exports.api = functions.region("asia-east2").https.onRequest(app);
