#!/usr/bin/sudo bash

#Verification de la connection internet...
if ! ping -q -c 5 -W 1 8.8.8.8 >/dev/null 
then
	  echo "Vous devez etre connecte a internet pour lancer ce script."
  	  exit 1
fi


#installation... (tar -xvf / tar czvf accesstalks AccessTalks...)
echo "-------------------------------------------------"
echo -e "AccessTalk's : Outils de presentation de logs de squid\nENSP-3GI annee 2016/2017\nAll right reserved\n"
echo "-------------------------------------------------"
echo "Installation de AccessTalk's"

#verification si node est installe...
echo "Verification de la presence du programme Node JS..."
if which node > /dev/null
   then
	echo "Node est installe."
   else
	echo "Node JS n'est pas encore installe. Installation de NodeJS..."
	curl-sL https://deb.nodesource.com/setup_8.x | sudo -E bash - 
	apt install -y nodejs
	npm cache clean -f
	npm install -g n
	n stable
        echo "Node est installe."
        #sleep 5
        
fi


echo "copie AccessTalk's ==> /usr/lib"
tar xzf accesstalks.tar.gz -C /usr/lib
mkdir /var/log/AccessTalks
mkdir /etc/AccessTalks
echo "Copie termine."

echo "installation des modules neccessaires..."
cd /usr/lib/AccessTalks
npm install || exit 1

echo "installation du lanceur dans /usr/bin..."
cp /usr/lib/AccessTalks/executables/launcher /usr/bin/accesstalks
echo "installation du lanceur termine."

echo "copie de fichiers de configuration ==> /etc/AccessTalks..."
cp /usr/lib/AccessTalks/executables/uninstall.sh /etc/AccessTalks/uninstall.sh
cp /usr/lib/AccessTalks/AccessTalks.conf /etc/AccessTalks/AccessTalks.conf
echo "copie effectue."

echo "copie du lanceur daemon ==> /etc/init.d/..."
cp /usr/lib/AccessTalks/executables/accesstalks_dae /etc/init.d/accesstalks
echo "copie effectuee."

echo "Installation du lancement au demarrage..."
update-rc.d accesstalks defaults
echo "fait."
echo "-------------------------"
echo "Installation termine."
echo "-------------------------"
echo -e "\n\nUtilisation :"
echo "sudo service accesstalks { start|stop|status|restart }"
echo "		ou	"
echo "sudo accesstalks { start|stop|status }"
