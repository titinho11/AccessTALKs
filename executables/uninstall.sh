#!/usr/bin/sudo bash

#desinstallation de AccessTalk's...

echo "Desinstallation de AccessTalk's..."
echo "suppression de AccessTalk's depuis /usr/lib"
rm -r /usr/lib/AccessTalks
rm -r /var/log/AccessTalks
rm -r /etc/AccessTalks
echo "suppression termine."

echo "suppression du lanceur de /usr/bin..."
rm /usr/bin/accesstalks
echo "suppression du lanceur termine."

echo "suppression du lanceur daemon ==> /etc/init.d/..."
rm /etc/init.d/accesstalks
echo "suppression effectuee."

echo "desinstallation du lancement au demarrage..."
update-rc.d -f accesstalks remove
echo "fait."
echo "-------------------------"
echo "Desinstallation termine."
