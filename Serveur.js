/*On importe les modules neccessaire*/
var fs = require('fs');
var http = require('http');
var schedule = require('node-schedule');
var path = require("path");
const express = require('express');

process.title = 'accesstalks dae';

const app = express();
app.set('port',(process.env.PORT || 1111)); 					//le port d'ecoute de l' application est mis a 80
app.use(express.static(__dirname + '/view'));
app.use('/jour', express.static(__dirname + '/view'));
app.use('/semaine', express.static(__dirname + '/view'));
app.set('views', './view');
app.set('view engine', 'ejs');

/*On demarre le serveur*/
const serveur = app.listen(app.get('port'), function(){
	console.log('AccessTalk ecoute sur le port ',app.get('port'));
});

/*On demarre la session socket.io*/
const io = require('socket.io')(serveur);

/*les variables du programme (consulter le document d'analyse et de conception pour mieux comprendre le role de ces variables)*/
var semaine, jour; 
var periode = {	"periode":{"00h-02h":{},"02h-04h":{},"06h-08h":{},"08h-10h":{},"10h-12h":{},"12h-14h":{},"14h-16h":{},"16h-18h":{},"18h-20h":{},"20h-22h":{},"22h-00h":{}}};
var deltaT, filename;

var emptyDataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };

var dataPeriode = JSON.parse(JSON.stringify(emptyDataPeriode));
var dataLive = {"client":{}, "sommeTempsTraitement":0,
	"nombreRequetteHit":0, "nombreRequetteMiss":0,
	"sommeNombreMega":0,	"site":{}, "ressource":{}};

/* recuperation du chemin du fichier et du delta t dans le fichier de config */
initConfig();

/*initConfig() remplie la variable filename si tout va bien*/
if (!filename) return console.log("Erreur : le fichier specifie par AccessTalks.conf est introuvable !");

var spawn = require('child_process').spawn;
var tail = spawn('tail', ['-f', filename]);
var exec = require('child_process').exec;

/*initialisation des variables jour et semaine (positionement des pointeurs sur la semaine et le jour en cour, voire le document)*/
initialiserSemaineEtJour();

/* Le serveur web ecoute la racine, puis home et repond index.ejs */
app.get('/', function(req, res){
	res.render('index');
});
app.get('/home', function(req, res){
	res.render('index');
});


/*le serveur web ecoute /jour/10_05_2015 et revoie la vu jour et les donnees du 10 mai 2015, si aucune donnees en memoire, renvoie la vue index avec un parametre d'erreur*/
app.get('/jour/:jr', function(req, res){

	var annee = req.params.jr.toString().split("_")[2];
	var mois = parseInt(req.params.jr.toString().split("_")[1]) - 1;
	var jr = req.params.jr.toString().split("_")[0];
	console.log(jr+" "+mois+" "+annee);
	var lejour = new Date(annee, mois, jr,0,0,0,0);
	var de = new Date(annee, mois, jr,0,0,0,0);console.log("ici de "+de);
	var lundi = getLundiDeLaSemaineDe(de);console.log("la date recu "+de+" et son lundi "+lundi);
	try{
		var content = fs.readFileSync("data/"+lundi+".json");
		var dataSemaine = JSON.parse(content);
		var dataDay = JSON.parse(JSON.stringify(dataSemaine[req.params.jr.toString().split("_")[0]]));
		console.log("on envoie le bon jour...");
		

		for (var d in dataDay){
			for (var p in d){
				for (var e in p){
					try{
						var a = Object.keys(p[e]).length;
					}catch(e){ continue;}
					if (Object.keys(p[e]).length === 0){
						p[e] = JSON.parse(JSON.stringify(emptyDataPeriode));
					}
				}
			}
		}
		console.log(JSON.stringify(dataDay));console.log("ici encore de "+de);
		res.render('jour',{dataDay:JSON.stringify(dataDay), jour:lejour.getDate()+" "+lejour.getMonth()+" "+lejour.getFullYear()});
		//console.log(semaine); console.log(jour);
		
	} catch(e){
		console.log(e);
		res.render('index', {dayNotFound:de});
	}
});

/*Attache des handlers aux evenements connection (d' un client sur l' addresse de AccessTALKs), periode et cheminFichier pour les requette de modification de la periode et du chemin du fichier log a analyser*/
io.sockets.on('connection', function(socket){
	console.log("une connexion ouverte !");
	socket.on('cheminFichier', function(data){
		console.log("le new fichier "+data);
		var content = fs.readFileSync("/etc/AccessTalks/AccessTalks.conf");
		filename = data;
		deltaT = parseInt(content.toString().trim().split(">>")[3]);
		fs.writeFile('/etc/AccessTalks/AccessTalks.conf', 'filepath>>'+filename+'>>deltaT>>'+deltaT, function (err) {
		  if (err) throw err;
		  console.log('Access.log path updated !');
		});

	}).on('periode', function(data){
		console.log("la new periode "+data);
		var content = fs.readFileSync("/etc/AccessTalks/AccessTalks.conf");
		filename = content.toString().trim().split(">>")[1];
		deltaT = data;
		fs.writeFile('/etc/AccessTalks/AccessTalks.conf', 'filepath>>'+filename+'>>deltaT>>'+deltaT, function (err) {
		  if (err) throw err;
		  console.log('Data read periode updated !');
		});
	});

});



/* On traite chaque nouvelle ligne du fichier */
tail.stdout.on('data', function(data){

	var line = data.toString();
	//console.log('la ligne : '+line);
	var tab = line.trim().split("\n");
	var tab = tab[0].split(" ");
	tab = epurer(tab);
	unInstant = tab[0];
	//console.log('requete '+tab[4]+' en '+tab[1]);

	/* somme Temps de traitement */
	dataLive.sommeTempsTraitement = parseInt(dataLive.sommeTempsTraitement) + parseInt(tab[1]);
	dataPeriode.sommeTempsTraitement = parseInt(dataPeriode.sommeTempsTraitement) + parseInt(tab[1]);

	/* les clients */
	if (tab[2] in dataLive.client) dataLive.client[tab[2]]++;
	else dataLive.client[tab[2]] = 1;
	if (tab[2] in dataPeriode.client) dataPeriode.client[tab[2]]++;
	else dataPeriode.client[tab[2]] = 1;

	/* la requette */
	if (tab[3].search('MISS') != -1) dataLive.nombreRequetteMiss++;
	if (tab[3].search('HIT') != -1) dataLive.nombreRequetteHit++;
	if (tab[3].search('MISS') != -1) dataPeriode.nombreRequetteMiss++;
	if (tab[3].search('HIT') != -1) dataPeriode.nombreRequetteHit++;
	
	/* somme nombre mega */
	dataLive.sommeNombreMega = parseInt(dataLive.sommeNombreMega) + parseInt(tab[4]);
	dataPeriode.sommeNombreMega = parseInt(dataPeriode.sommeNombreMega) + parseInt(tab[4]);

	/* le site */
	if (tab[6] in dataLive.site) dataLive.site[tab[6]]++;
	else dataLive.site[tab[6]] = 1;
	if (tab[6] in dataPeriode.site) dataPeriode.site[tab[6]]++;
	else dataPeriode.site[tab[6]] = 1;
	
	/* la ressource */
	if (8 < tab.length){
		if ( tab[8] in dataLive.ressource ) dataLive.ressource[tab[8]]++;
		else dataLive.ressource[tab[8]] = 1;
		if ( tab[8] in dataPeriode.ressource ) dataPeriode.ressource[tab[8]]++;
		else dataPeriode.ressource[tab[8]] = 1;
	}

	//console.log('****');
});


/* On programme l'envoie les data live par socket.io */
setInterval(function(){
	//console.log('--------------------');
	dataLive.instant = new Date().toLocaleTimeString();
	//console.log(dataLive);
	//console.log("envoie de datalive... et reinitialisation de dataLive");
	io.sockets.emit('dataLive', dataLive);
	dataLive = {"client":{}, "sommeTempsTraitement":0,
	"nombreRequetteHit":0, "nombreRequetteMiss":0,
	"sommeNombreMega":0,	"site":{}, "ressource":{}};
	//console.log('-------------------- '+dataLive.instant);
}, deltaT);

/* On programme l' enregistrement du dataPeriode */
//de 00h - 02h
var j1 = schedule.scheduleJob('0 2 * * *', function(){
	initialiserSemaineEtJour();
	semaine[jour]["periode"]["00h-02h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (00h - 02h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 02h - 04h
var j2 = schedule.scheduleJob('0 4 * * *', function(){
	semaine[jour]["periode"]["02h-04h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (02h - 04h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 04h - 06h
var j3 = schedule.scheduleJob('0 6 * * *', function(){
	semaine[jour]["periode"]["04h-06h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (04h - 06h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 06h - 08h
var j4 = schedule.scheduleJob('0 8 * * *', function(){
	semaine[jour]["periode"]["06h-08h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (06h - 08h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 08h - 10h
var j5 = schedule.scheduleJob('0 10 * * *', function(){
	semaine[jour]["periode"]["08h-10h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (08h - 10h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 10h - 12h
var j6 = schedule.scheduleJob('0 12 * * *', function(){
	semaine[jour]["periode"]["10h-12h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (10h - 12h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 12h - 14h
var j7 = schedule.scheduleJob('0 14 * * *', function(){
	semaine[jour]["periode"]["12h-14h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (12h - 14h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 14h - 16h
var j8 = schedule.scheduleJob('0 16 * * *', function(){
	semaine[jour]["periode"]["14h-16h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (14h - 16h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 16h - 18h
var j9 = schedule.scheduleJob('0 18 * * *', function(){
	semaine[jour]["periode"]["16h-18h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (16h - 18h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 18h - 20h
var j10 = schedule.scheduleJob('0 20 * * *', function(){
	semaine[jour]["periode"]["18h-20h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (18h - 20h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 20h - 22h
var j11 = schedule.scheduleJob('0 22 * * *', function(){
	semaine[jour]["periode"]["20h-22h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (20h - 22h)');
	console.log(semaine);
	console.log("///////////////////");
});
//de 22h - 00h
var j12 = schedule.scheduleJob('0 0 * * *', function(){
	console.log(semaine);
	semaine[jour]["periode"]["22h-00h"] = JSON.parse(JSON.stringify(dataPeriode));
	dataPeriode = {"client":{}, "sommeTempsTraitement":0,
								 "sommeNombreMega":0, "site":{},
								 "ressource":{}, "nombreRequetteHit":0, "nombreRequetteMiss":0 };
	/*ecraser fichier semaine*/
	saveSemaine();
	console.log('Donnees de la periode enregistree ! (22h - 00h)');
	console.log(semaine);
	console.log("///////////////////");
});

/* TODO:
	- Mettre l' icone de l' appli web
	- Ajouter la journalisation dans un fichier log
*/

/*Fonctions utiles*/

/*cette fonction enleve d' un tableau les entree ' ', '-', et ''*/
function epurer(tab){
	var l = new Array();
	for (var key in tab) {
		if (tab[key] !='' && tab[key] != ' ' && tab[key] !='-')
			l.push(tab[key]);
	}
	return l;
}

/*cette fonction compte le nombre d'occurence d' une sous chaine dans une chaine*/
function countInstances(string, word) {
   var substrings = string.split(word);
   return substrings.length - 1;
}

/*cette fonction enregistre dans le fichier de la semaine courante les infos de la variable semaine*/
function saveSemaine(){
	fs.writeFile("data/"+semaine.nomFichier, JSON.stringify(semaine) , function (err) {
  		if (err) throw err;
  		console.log('Semaine saved!');
	});
}

/*Cette fonction renvoie sous le format numJour_numMois_annee du lundi de la semaine du jour en argument*/
function getLundiDeLaSemaineDe(date){
	var lundiDansMoi = date.getDate() - date.getDay() + 1;
	var lundi = new Date(date.setDate(lundiDansMoi));
	var numJ = ( parseInt(lundi.getDate()/10)>=1 )? lundi.getDate():"0"+lundi.getDate();
	var numM = ( parseInt((lundi.getMonth()+1)/10)>=1 )? lundi.getMonth()+1:"0"+(lundi.getMonth()+1);
	return numJ+"_"+numM+"_"+lundi.getFullYear();
}

/*Cette fonction s' assure que les variables jour et semaines pointeronts sur les bons fichiers en memoire, en fonction du jour actuel*/
function initialiserSemaineEtJour(){
	var lund = getLundiDeLaSemaineDe(new Date());
	try{
		var content = fs.readFileSync("data/"+lund+".json");
		semaine = JSON.parse(content);
		var now = new Date();
		jour = ( parseInt(now.getDate()/10)>=1 )? now.getDate():"0"+now.getDate();	
		jour = jour.toString();
		//console.log(semaine); console.log(jour);
		
	} catch(e){
		console.log("creation du fichier de donnees de la semaine...");
		/* creer, initialiser et stocker le fichier */
		var tab = new Array();
		var lundi = new Date(lund.split("_")[2], parseInt(lund.split("_")[1])-1, parseInt(lund.split("_")[0]));tab.push(new Date(lundi));
		var mardi = new Date(lundi.setDate(lundi.getDate()+1));tab.push(new Date(mardi));
		var mercredi = new Date(mardi.setDate(mardi.getDate()+1));tab.push(new Date(mercredi));
		var jeudi = new Date(mercredi.setDate(mercredi.getDate()+1));tab.push(new Date(jeudi));
		var vendredi = new Date(jeudi.setDate(jeudi.getDate()+1));tab.push(new Date(vendredi));
		var samedi = new Date(vendredi.setDate(vendredi.getDate()+1));tab.push(new Date(samedi));
		var dimanche = new Date(samedi.setDate(samedi.getDate()+1));tab.push(new Date(dimanche));
		semaine = {};
		for (var key in tab){
			var numJ = ( parseInt(tab[key].getDate()/10)>=1 )? tab[key].getDate():"0"+tab[key].getDate();
			semaine[numJ] = JSON.parse(JSON.stringify(periode));
		}
		semaine["nomFichier"] = lund+".json";
		saveSemaine();
		jour = ( parseInt(tab[0].getDate()/10)>=1 )? tab[0].getDate().toString():"0"+tab[0].getDate();
		console.log("fichier cree !");
		console.log(semaine);
	}
}

/*Cette fonction lis le fichier AccessTalk.conf et recupere la valeur du temps reel, et le chemin d' access vers le fichier access.log*/
function initConfig(){
	var content = fs.readFileSync("/etc/AccessTalks/AccessTalks.conf");
	filename = content.toString().trim().split(">>")[1];
	deltaT = parseInt(content.toString().trim().split(">>")[3]);
}

/*NB:*/
/* 
	.
	.
	.
*/