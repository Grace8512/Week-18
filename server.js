var express = require("express");
var exphbs = require("express-handlebars");
var mongoose = require("mongoose");
var path = require("path");

// Parses our HTML and helps us find elements
var cheerio = require("cheerio");
// Makes HTTP request for HTML page
var axios = require("axios");

//Require models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");

//port and express : .env파일에서 포트라는 베리어블을 가지고 있는 파일이 있으면 그걸 쓰고 없으면 3000번을 쓰라는 뜻. 
var PORT = process.env.PORT || 3000;
var app = express();

// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Make public a static folder
app.use(express.static("public"));

//Set up handlevar view
app.engine("handlebars", exphbs({ defaultLayout: "main", partialsDir: path.join(__dirname, "/views/layouts/partials")}));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
var mongodb_url = process.env.MONGO_URL || "mongodb://localhost:27017";
mongoose.connect( mongodb_url, { useNewUrlParser: true });
var db = mongoose.connection;

//test mongooes
db.on("error", function(err){
  console.log("mongoose err: ", error);
});

db.once("open", function(){
  console.log("Mongoose connection successful.");
});

//get handlebar page
app.get("/", function(req,res){
  Article.find({"saved": false}, function(err, data){
    var mdObject = {
      article: data
    };
    console.log(mdObject);
    res.render("home", mdObject);
  });
});

app.get("/saved", function(req, res){
  Article.find({"saved": true}).populate("note").exec(function(err, articles){
    var mdObject = {
      article: articles
    };
    res.render("saved", mdObject);
  });
});

app.get("/scrape", function(req, res){
  // Making a request via axios for reddit's "webdev" board. The page's HTML is passed as the callback's third argument
  axios.get("https://www.medicalnewstoday.com/").then(function(response) {

  // Load the HTML into cheerio and save it to a variable
  // '$' becomes a shorthand for cheerio's selector commands, much like jQuery's '$'
  var $ = cheerio.load(response.data);

  // With cheerio, find each p-tag with the "title" class
  // (i: iterator. element: the current element)
  $("li.css-1ib8oek").each(function(i, element) {

    // Save the text of the element in a "title" variable
    var title = $(element).find("a.css-ni2lnp").text();

    // In the currently selected element, look at its child elements (i.e., its a-tags),
    // then save the values for any "href" attributes that the child elements may have
    var link = $(element).find("a.css-ni2lnp").attr("href");

    var summary = $(element).find("a.css-2fdibo").text();

    var image = $(element).find("lazy-image").attr("src");
    var realImage = image?image.split("?")[0].substr(2):undefined;

    // Save these results in an object that we'll push into the results array we defined earlier
    if(title){
      var result = {title: title, link: link, summary: summary, image: realImage};
      db.Article.create(result)
        .then(function(dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function(err) {
          // If an error occurred, log it
          console.log(err);
        });
      }
    });
    // Log the results once you've looped through each of the elements found with cheerio
    console.log(results);
  });
});

app.get("/articles", function(req, res){
  Article.find({}, function(err, data){
    if(err){
      console.log("article err: ", err);
    }else{
      res.json(data);
    }
  });
});

//article id
app.get("/articles/:id", function(req, res){
  Article.findOne({"_id": req.params.id}).populate("note").exec(function(err, data){
    if(err){
      console.log(err);
    }else{
      res.json(doc);
    }
  });
});

//save article
app.post("/articles/saved/:id", function(req, res){
  Article.findOneAndUpdate({"_id": req.params.id}, {"saved": true})
  .exec(function(err,data){
    if(err)throw err;
    res.send(data);
  });
});

//delete article
app.post("/articles/delete/:id", function(req, res){
  Article.findOneAndRemove({"_id": req.params.id}, {"saved":false, "note":[]})
  .exec(function(err, data){
    if(err) throw err;
    res.send(data);
  });
});

//create note
app.post("/note/saved/:id", function(req, res){
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  // console.log(req.body);
  newNote.saved(function(err,note){
    if(err){
      console.log("note save err: ", err);
    }else{
      Article.findByIdAndUpdate({"_id": req.params.id}, {$push: {"note":note}})
      .exec(function(err){
        if(err)throw err;
        res.send(note);
      });
    }
  });
});

//delete note
app.delete("/note/delete/:note_id/:article_id", function(req, res){
  Note.findByIdAndRemove({"_id": req.params.note_id}, function(err){
    if(err){
      console.log(err);
      res.send(err);
    }else{
      Article.findOneAndUpdate({"_id": req.params.article_id}, {$pull: {"note": req.params.note_id}})
      .exec(function(err){
        if(err) throw err;
        res.send("Note Deleted");
      });
    }
  });
});

//Listen port
app.listen(PORT, function(){
  console.log("Listening on port: " + PORT);
});