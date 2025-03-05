const express = require('express');
const app = express();

const clientID = "8bd1936208934a1b8060d5f03cc0b95a"; // I put this in the .env file, DO NOT SHARE THIS WITH ANYBODY (not even me)
const clientSecret = "4e6e59bc72204582974d04b52a46e76d"; // I put this in the .env file, DO NOT SHARE THIS WITH ANYBODY (not even me)

// an .env file is a file that securely stores environment variables, which are used to configure your application.
// It's way more secure than just putting them here.


async function getToken() {
    let req;
    try {
        req = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': clientID,
                'client_secret': clientSecret
            })
        })
    } catch (error) {
        console.error("Error getting token", error)
    }

    if (!req) return console.error("Error getting token")
    const data = await req.json()
    return data?.accessToken;
}


// This thing wont work, because you're getting a basic token with no OAuth. If you want to get access to the OAuth permissions you will
// have to Authorize with your user accound, save the Access Token and Refresh Token, and when the AccessToken expires, you need to to get a new AccessToken using the RefreshToken.
async function getPlayerState(accessToken) {
    let req;
    try {
        req = await fetch("https://api.spotify.com/v1/me/player", {
            method: "GET",
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
    } catch (error) {
        console.error("Error getting player state", error)
    }

    if (!req) return console.error("Error getting player state")
    const data = await req.json()
    return data;
}


// Declares the HTML static code
app.use(express.static("public"))

// Declares the API Endpoints
app.get("/api/playerState", async (req, res) => {
    const accessToken = await getToken();
    const playerState = await getPlayerState(accessToken);
    if (!accessToken || !playerState) return res.status(401).send("Unauthorized");
    res.send(playerState);
})

app.listen(80, () => { // I recommend using port 3000
    console.log(`App running @ http://localhost:${process.env.PORT}`)
})
