const express = require('express')
const axios = require("axios")
const sqlite3 = require("sqlite3")
const app = express()

require("dotenv").config()

// git test
// Load DB 

const db = new sqlite3.Database("./cache.db")

//Podria ponerlo en undefinded pero perezacambiarlo ahora xd 3/02/24 4:34
var accessToken = ""
var spicyVersion = "99.99.99"

var playerState = {}
async function getPlayerState(accessToken) {
    //console.log("TOJEN", accessToken)
    const response = await axios.get(
        "https://api.spotify.com/v1/me/player",
        {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        }
    ).catch((error)=>{
        console.log("Failed", error.data, error.status)
        if (error.status == 401) {
            return "Token Expired"
        }
    })

    return response
}

async function getArtistBanner(ArtistURI, TrackURI) {
    if (!ArtistURI || !TrackURI) return "No artist or track was provided"
    
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM bannerCache WHERE artist = ?", [ArtistURI], async (err, data) => {
            if (err != null) return reject(err);
            console.log(data)
            if (data) {
                if ((data.expireDate - new Date()) >= 0) {
                    return resolve(data.link)
                }
                
                console.log("Expired cache")
                db.run("DELETE FROM bannerCache WHERE artist = ?", ArtistURI)
            }
            

            const response = await axios.get(
                `https://api.spicylyrics.org/artist/visuals?artist=${ArtistURI}&track=${TrackURI}?origin_version=${spicyVersion}`,
                {
                    headers: {
                        "Authorization": `Bearer ${await getSpotifyToken()}`,
                        "access-token": "KCkLu$LyXZu2s%4$1FCJ&yUpsSYhw$5W7N%DZgq#f24$b8k*1#88iD51S#e6%!",
        
                        "User-Agent": "Spicy SpotifyClient Web (craciu25yt)",
                        "Source-Origin": "SpotifyClientRemake--craciu25_YT"
                    }
                }
            ).catch((error) => {
                console.log("Error while trying to get Artist Banner", error.status, error.data)
                // Fallback background
                return {error: "Internal error 500"}
            })
            
            if (response.error) {
                return resolve("http://localhost/dellafuente-cover.jpg")
            }
            
            console.log(response.data, response.status)
            if (!response.data.Visuals) {
                return resolve("No data provided. Probably token is expired")
            }
            if (!response.data.Visuals.headerImage) {
                return resolve("Artist doesn't have a banner")
            } 
            const bannerUrl = response.data.Visuals.headerImage.sources[0].url
            db.run("INSERT INTO bannerCache (artist, link, expireDate) VALUES (?, ?, ?)", [ArtistURI, bannerUrl, new Date().setDate(new Date().getDate() + 7)], (err) => {
                if (err) {
                    console.error("Failed db cache write", err)
                    return reject("Internal error 500")
                }
            })
                    

            return resolve(bannerUrl)
            
            //return response.data.Visuals ? response.data.Visuals.headerImage.sources[0].url : "Error while getting the banner"
        })
    })


    

}
async function getLyrics(TrackURI) {
    if (!TrackURI) return "Track was provided"
    
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM lyricsCache WHERE TrackURI = ?", [TrackURI], async (err, data) => {
            if (err != null) return reject(err);
            
            console.log("Cached lyrics check", TrackURI)
            if (data) {
                
                if ((data.expireDate - new Date()) >= 0) {
                    console.log("Cached lyrics found", TrackURI)
                    console.log(typeof data.data)
                    return resolve(data.data)
                }
                
                console.log("Expired cache")
                db.run("DELETE FROM lyricsCache WHERE TrackURI = ?", [TrackURI])
            }
            
            const response = await axios.get(
                `https://api.spicylyrics.org/lyrics/${TrackURI.split(":")[2]}?origin_version=${spicyVersion}`,
                {
                    headers: {
                        "Authorization": `Bearer ${await getSpotifyToken()}`,
                        "access-token": "KCkLu$LyXZu2s%4$1FCJ&yUpsSYhw$5W7N%DZgq#f24$b8k*1#88iD51S#e6%!",
        
                        "User-Agent": "Spicy SpotifyClient Web (craciu25yt)",
                        
                        "Source-Origin": "SpotifyClientRemake--craciu25_YT"
                    }
                }
            ).catch((error) => {
                if (error.status == 404) {
                    return {error: "No lyrics found"}
                }
                console.log("Error while trying to get Lyrics", error.status, error.data)
                // Fallback background
                return {error: "Internal error 500"}
            })
            if (response.error) {
                return resolve(response)
            }
            console.log("Lyrics req", response.status)
        
            if (!response.data) {
                return resolve("No data provided. Probably token is expired xd")
            } 
            
            db.run("INSERT INTO lyricsCache (TrackURI, data, expireDate) VALUES (?, ?, ?)", [TrackURI, JSON.stringify(response.data), new Date().setDate(new Date().getDate() + 7)], (err) => {
                if (err) {
                    console.error("Failed db cache write", err)
                    return reject("Internal error 500")
                }
            })

            return resolve(response.data)
        
        })
    })


    

}
async function getQueue() {
    const response = await axios.get(
        "https://api.spotify.com/v1/me/player/queue",
        {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        }
    ).catch((error)=>{
        console.log("Failed", error.data, error.status)
        if (error.status == 401) {
            return "Token Expired"
        }
    })  
    return response.data
}

const tokenMap = new Map()

async function getSpotifyToken() {
    const query = tokenMap.get("user_token")

    if (query && query.expiresAt > new Date().getTime()) {
        //console.log("Using cached token", query)
        return query.accessToken
    }

    const response = await axios.get(
        "https://open.spotify.com/get_access_token?reason=transport&productType=web_player"
    ).catch((error) => {
        console.log("Failed to get the Spotify Token", error.data, error.status)
        process.exit(1)
    })
    console.log(response.data)
    tokenMap.set("user_token", {
        accessToken: response.data.accessToken,
        expiresAt: response.data.accessTokenExpirationTimestampMs
    })
    return response.data.accessToken
}

async function getSpicyVersion() {
    const response = await axios.get(
        "https://api.spicylyrics.org/version"
    ).catch((error) => {
        console.log("Failed to get the Spicy Version", error.data, error.status)
        process.exit(1)
    })
    spicyVersion = response.data
}

// Refresh routine
setInterval(async () => {
    if (accessToken == "") return;
    
    const date = new Date()
    res = await getPlayerState(accessToken)
    //TODO: Renew the token
    if(!res) {
        console.log("Expired token")
        playerState = false
        return
    }
    playerState = { data: res.data, lastUpdate: date.getTime() }
    console.log(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} | PlayerState updated`)

}, 1000)

async function main() {


    // Declares the HTML static code
    app.use(express.static("public"))


    // Declares the API Endpoints
    app.get('/api', (req, res) => {
        res.send('401')
    })
    app.get("/api/playerState", async (req, res) => {
        if (accessToken == "" || playerState == false ) {
            res.send("No authorization found").status(401)
            return
        }
        res.send({...playerState, sentAt: new Date().getTime()})
    })

    app.get("/api/isAuthed", async (req, res) => {
        res.send(accessToken == "" ? "false" : "true")
    })

    app.get("/api/getArtistBanner", async (req, res) => {
        res.send(await getArtistBanner(req.query.ArtistURI, req.query.TrackURI))
    })

    app.get("/api/getLyrics", async (req, res) => {
        res.send(await getLyrics(req.query.TrackURI))
    })

    app.get("/api/queue", async (req, res) => {
        if (accessToken == "" || playerState == false ) {
            res.send("No authorization found").status(401)
            return
        }
        res.send(await getQueue())
    })

    
    app.get("/auth/login", (req, res) => {
        var scopes = "streaming \
        user-read-playback-state \
        user-read-email \
        user-read-private"
        var parms = new URLSearchParams({
            response_type: "code",
            client_id: process.env.CLIENT_ID,
            scope: scopes,
            redirect_uri: "http://localhost/auth/callback"
        })
        res.redirect("https://accounts.spotify.com/authorize/?" + parms.toString())
    })

    app.get("/auth/callback", async (req, res) => {
        var code = await req.query.code
        if (code == undefined) {
            res.send("Unauthorized").status(401)
            return
        }
        console.log("CODE:", code)
        var authOptions = {
            method: "post",
            url: "https://accounts.spotify.com/api/token",
            
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64')),
                'Content-Type' : 'application/x-www-form-urlencoded'
              },

            data: new URLSearchParams({
                code: code,
                redirect_uri: "http://localhost/auth/callback",
                grant_type: 'authorization_code'
            })
        }
        const response = await axios(authOptions)
        .catch((err) => {
            if (err.code == "ERR_BAD_REQUEST") {
                res.send("BAD_REQUEST").status(400)
                return
            }
            console.log(err.code)
            console.log(err.data)
        })
        //console.log(response)
        if (response.status == 200) {
            accessToken = (await response).data.access_token
            console.log(accessToken)
            res.redirect("/auth/success.html")
        }
    })

    await getSpicyVersion()

    app.listen(process.env.PORT, "0.0.0.0", () => {
        console.log(`App running @ http://localhost:80`)
    })
}

main()