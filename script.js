/* ===================================================================
   Tőzsde bemutató — script.js
   Ez kezeli a szimulációt: vásárlás, eladás, a "Következő nap" gomb,
   az árfolyam kiszámolása és a grafikon (oszlopok) frissítése.

   FONTOS: ezt a fájlt be kell linkelni a HTML-ben a </body> elé, mert
   most még nincs is <script> tag rá:
       <script src="script.js"></script>
   =================================================================== */

// ---------- Alap beállítások (ezeket nem változtatjuk menet közben) ----------

var KEZDO_AR = 2000;          // a részvény mindig 2000 Ft-ról indul
var ARVALTOZAS_SZORZO = 3;    // 3 Ft árváltozás minden 1 db nettó vételi/eladási különbségre
var GRAFIKON_NAGYITAS = 10;  // a grafikonon az árváltozás 10x látszik nagyobbnak
var REGISZTRALASI_KUSZOB = 5; // 5 Ft alatti napi változást a botok nem veszik "igazi" változásnak
var NAGY_UGRAS = 30;          // az 1. botnak ez számít nagy ugrásnak
var CEL_OSSZEG = 200000;      // ha penz + reszvenyek erteke eleri ezt, nyertel

// ---------- Játékos állapota ----------

var penz = 20000;
var reszveny = 10;
var aktualisAr = KEZDO_AR;

var arfolyamTortenet = []; // az eddigi napi záróárak listája (a legutolsó elem a mai ár)

// a mai napon (a legutóbbi "Következő nap" óta) mennyit vett/adott el a JÁTÉKOS
var maiVetel = 0;
var maiEladas = 0;

// ---------- A 3 "emberke" (bot) belső állapota — ez a felhasználónak nem látszik ----------

var bot1Penz = 50000;
var bot1Reszveny = 20;

var bot2Penz = 10000;
var bot2Reszveny = 40;

var bot3Penz = 30000;
var bot3Reszveny = 0;
var bot3VanReszvenye = false; // false = keszpenzben var, true = mar vett reszvenyt es profitra var
var bot3VetelAr = 0;
var bot3EsesSzamlalo = 0;

// ===================================================================
// Segédfüggvények
// ===================================================================

// megkeresi egy tömb legnagyobb elemét, egyszerű ciklussal
function maximumKikereses(tomb) {
    var max = tomb[0];
    for (var i = 1; i < tomb.length; i++) {
        if (tomb[i] > max) {
            max = tomb[i];
        }
    }
    if (max < 1) {
        max = 1; // hogy ne legyen osztás 0-val a magasság számolásnál
    }
    return max;
}

// kiszámolja egy tömb átlagát (ehhez képest mutatjuk a változást a grafikonon)
function atlagKiszamitas(tomb) {
    var osszeg = 0;
    for (var i = 0; i < tomb.length; i++) {
        osszeg = osszeg + tomb[i];
    }
    return osszeg / tomb.length;
}

// ellenőrzi, hogy a beírt szöveg egy érvényes pozitív egész szám-e
// ha nem az, kiírja a hibát a #hiba span-be és null-t ad vissza
function ervenyesSzamEllenorzes(szoveg) {
    var hibaSpan = document.getElementById("hiba");

    if (szoveg === "" || szoveg === null) {
        hibaSpan.textContent = "Hibás bemenet, csak pozitív szám adható meg!";
        return null;
    }

    var szam = Number(szoveg);

    if (isNaN(szam)) {
        hibaSpan.textContent = "Hibás bemenet, csak pozitív szám adható meg!";
        return null;
    }

    if (szam <= 0) {
        hibaSpan.textContent = "Hibás bemenet, csak pozitív szám adható meg!";
        return null;
    }

    if (Math.floor(szam) !== szam) {
        hibaSpan.textContent = "Hibás bemenet, csak egész szám adható meg!";
        return null;
    }

    return szam;
}

// az utolsó két lezárt nap közötti különbség (ez alapján döntenek a botok)
function utolsoValtozas() {
    var n = arfolyamTortenet.length;
    if (n < 2) {
        return 0;
    }
    return arfolyamTortenet[n - 1] - arfolyamTortenet[n - 2];
}

// true, ha az utolsó 3 nap mindegyikén "igazi" (5 Ft-nál nagyobb) esés volt
function harmasCsokkenesEllenorzes() {
    var n = arfolyamTortenet.length;
    if (n < 4) {
        return false;
    }
    var v1 = arfolyamTortenet[n - 1] - arfolyamTortenet[n - 2];
    var v2 = arfolyamTortenet[n - 2] - arfolyamTortenet[n - 3];
    var v3 = arfolyamTortenet[n - 3] - arfolyamTortenet[n - 4];

    if (v1 < -REGISZTRALASI_KUSZOB && v2 < -REGISZTRALASI_KUSZOB && v3 < -REGISZTRALASI_KUSZOB) {
        return true;
    }
    return false;
}

// ===================================================================
// A három bot viselkedése
// mindegyik visszaad egy { vetel: X, eladas: Y } objektumot,
// és közben a saját (rejtett) pénzét/részvényét is frissíti
// ===================================================================

function bot1Kereskedes(valtozas) {
    var vetelDb = 0;
    var eladasDb = 0;

    if (Math.abs(valtozas) > NAGY_UGRAS) {
        // nagy ugrás volt (fel vagy le), inkább realizál egy kis nyereséget
        eladasDb = 5;
    } else if (Math.abs(valtozas) <= REGISZTRALASI_KUSZOB) {
        // szinte semmi nem mozdult, ilyenkor a duplájára pörgeti a vásárlást
        vetelDb = 10;
    } else {
        // egy sima nap, minden nap ennyit szokott venni
        vetelDb = 5;
    }

    // ne menjen a sajátjából mínuszba
    if (eladasDb > bot1Reszveny) {
        eladasDb = bot1Reszveny;
    }
    if (vetelDb * aktualisAr > bot1Penz) {
        vetelDb = Math.floor(bot1Penz / aktualisAr);
    }

    bot1Penz = bot1Penz - vetelDb * aktualisAr + eladasDb * aktualisAr;
    bot1Reszveny = bot1Reszveny + vetelDb - eladasDb;

    return { vetel: vetelDb, eladas: eladasDb };
}

function bot2Kereskedes() {
    var vetelDb = 0;
    var eladasDb = 0;

    if (harmasCsokkenesEllenorzes()) {
        // 3 napja csak lefele megy, csak elad, de mindig hagy legalabb 10-et
        var mennyit = 5 + Math.floor(Math.random() * 4); // kb. 5-8 db, se sok se keves
        if (bot2Reszveny - mennyit < 10) {
            mennyit = bot2Reszveny - 10;
        }
        if (mennyit < 0) {
            mennyit = 0;
        }
        eladasDb = mennyit;
    } else {
        // nem teljesult a feltetele, akkor egy kicsit random kereskedik
        var random_mennyiseg = 1 + Math.floor(Math.random() * 5); // 1-5 db
        if (Math.random() < 0.5) {
            if (random_mennyiseg * aktualisAr <= bot2Penz) {
                vetelDb = random_mennyiseg;
            }
        } else {
            if (bot2Reszveny - random_mennyiseg >= 10) {
                eladasDb = random_mennyiseg;
            }
        }
    }

    bot2Penz = bot2Penz - vetelDb * aktualisAr + eladasDb * aktualisAr;
    bot2Reszveny = bot2Reszveny + vetelDb - eladasDb;

    return { vetel: vetelDb, eladas: eladasDb };
}

function bot3Kereskedes(valtozas) {
    var vetelDb = 0;
    var eladasDb = 0;
    var jelentosValtozas = Math.abs(valtozas) > REGISZTRALASI_KUSZOB;

    if (bot3VanReszvenye) {
        // van reszvenye, arra var hogy tobbet erjen mint amennyiert vette
        if (aktualisAr > bot3VetelAr) {
            eladasDb = bot3Reszveny; // eladja mindenet, ez a nyeresege
            bot3VanReszvenye = false;
            bot3EsesSzamlalo = 0;
        } else if (Math.random() < 0.2) {
            // ritkan egy kicsit akkor is kereskedik, hogy eletszerubb legyen
            var kicsi1 = 1 + Math.floor(Math.random() * 3);
            if (kicsi1 <= bot3Reszveny) {
                eladasDb = kicsi1;
            }
        }
    } else {
        // keszpenzben ul, a nagy zuhanas utani pillanatot varja
        if (jelentosValtozas && valtozas < 0) {
            bot3EsesSzamlalo = bot3EsesSzamlalo + 1;
        } else if (jelentosValtozas && valtozas > 0) {
            bot3EsesSzamlalo = 0; // ha megfordult, ujra kezdi szamolni az eseseket
        }

        if (bot3EsesSzamlalo >= 5) {
            // 5 eses utan mar ugy gondolja itt a legalja, mindent bevet
            vetelDb = Math.floor(bot3Penz / aktualisAr);
            if (vetelDb > 0) {
                bot3VetelAr = aktualisAr;
                bot3VanReszvenye = true;
            }
            bot3EsesSzamlalo = 0;
        } else if (!jelentosValtozas && Math.random() < 0.3) {
            // nincs erdemi valtozas, ritkan vesz egy keveset
            var kicsi2 = 1 + Math.floor(Math.random() * 3);
            if (kicsi2 * aktualisAr <= bot3Penz) {
                vetelDb = kicsi2;
            }
        }
    }

    bot3Penz = bot3Penz - vetelDb * aktualisAr + eladasDb * aktualisAr;
    bot3Reszveny = bot3Reszveny + vetelDb - eladasDb;

    return { vetel: vetelDb, eladas: eladasDb };
}

// ===================================================================
// Árfolyam számítás
// ===================================================================

function ujArfolyamSzamitas(regiAr, nettoMennyiseg) {
    var valtozas = nettoMennyiseg * ARVALTOZAS_SZORZO;
    var ujAr = regiAr + valtozas;
    if (ujAr < 1) {
        ujAr = 1; // az ar nem mehet 0 vagy negativ ala
    }
    return Math.round(ujAr);
}

// ===================================================================
// Kijelzés / grafikon frissítése
// ===================================================================

function oszlopBeallitasa(div, ar, elozoAr, maxAr, atlagAr) {
    // az oszlop a 50%-os magassagbol indul, es az atlagtol valo elteres
    // 10x nagyitva latszik (igy egy pici valtozas is jol kivehetö)
    var szazalek = 50 + ((ar - atlagAr) / maxAr) * 100 * GRAFIKON_NAGYITAS;
    if (szazalek < 5) {
        szazalek = 5;   // hogy mindig latszodjon egy kicsi oszlop
    }
    if (szazalek > 100) {
        szazalek = 100; // ne lognon ki a dobozbol
    }
    div.style.height = szazalek + "%";

    div.classList.remove("zold");
    div.classList.remove("piros");

    if (elozoAr !== undefined) {
        if (ar > elozoAr) {
            div.classList.add("zold");
        } else if (ar < elozoAr) {
            div.classList.add("piros");
        }
    }
}

function grafikonFrissites() {
    var napNevek = ["10nap", "9nap", "8nap", "7nap", "6nap", "5nap", "4nap", "3nap", "2nap", "1nap"];
    var n = arfolyamTortenet.length;

    var kezdoIndex = n - 11;
    if (kezdoIndex < 0) {
        kezdoIndex = 0;
    }

    var lathatoArak = arfolyamTortenet.slice(kezdoIndex);
    var maxAr = maximumKikereses(lathatoArak);
    var atlagAr = atlagKiszamitas(lathatoArak);

    for (var i = 0; i < napNevek.length; i++) {
        var index = kezdoIndex + i;
        var elem = document.getElementById(napNevek[i]);
        if (elem && arfolyamTortenet[index] !== undefined) {
            oszlopBeallitasa(elem, arfolyamTortenet[index], arfolyamTortenet[index - 1], maxAr, atlagAr);
        }
    }

    // az utolsó, id nélküli div a mai (jelenlegi) nap
    var osszesOszlop = document.querySelectorAll(".arfolyam > div");
    var maiOszlop = osszesOszlop[osszesOszlop.length - 1];
    if (maiOszlop) {
        oszlopBeallitasa(maiOszlop, aktualisAr, arfolyamTortenet[n - 2], maxAr, atlagAr);
    }
}

function kijelzesFrissites() {
    document.getElementById("ertek").textContent = aktualisAr;
    document.getElementById("penz").textContent = penz;
    document.getElementById("reszveny").textContent = reszveny;
    document.getElementById("reszvenyErtek").textContent = reszveny * aktualisAr;
}

function celEllenorzes() {
    var teljesVagyon = penz + reszveny * aktualisAr;
    if (teljesVagyon >= CEL_OSSZEG) {
        alert("Gratulálok, elérted a 200 000 Ft-ot — nyertél!");
    } else if (penz <= 0 && reszveny <= 0) {
        alert("Elfogyott a pénzed és a részvényeid is — sajnos vesztettél. Tölsd újra az oldalt az újrakezdéshez.");
    }
}

// ===================================================================
// Indítás, amikor az oldal betöltött
// ===================================================================

document.addEventListener("DOMContentLoaded", function () {

    // az árfolyam-történetet feltöltjük 11 db kezdőárral, hogy a grafikon
    // rögtön teljesen ki legyen töltve
    for (var i = 0; i < 11; i++) {
        arfolyamTortenet.push(KEZDO_AR);
    }

    grafikonFrissites();
    kijelzesFrissites();

    // ---------- Vásárlás gomb ----------
    document.getElementById("vasarlas").addEventListener("click", function () {
        var mezo = document.getElementById("vasarlasMennyiseg");
        var mennyiseg = ervenyesSzamEllenorzes(mezo.value);
        if (mennyiseg === null) {
            return;
        }

        var koltseg = mennyiseg * aktualisAr;
        if (koltseg > penz) {
            document.getElementById("hiba").textContent = "Nincs elég pénzed ehhez a vásárláshoz!";
            return;
        }

        penz = penz - koltseg;
        reszveny = reszveny + mennyiseg;
        maiVetel = maiVetel + mennyiseg;

        document.getElementById("hiba").textContent = "";
        mezo.value = "";
        kijelzesFrissites();
        celEllenorzes();
    });

    // ---------- Eladás gomb ----------
    document.getElementById("eladas").addEventListener("click", function () {
        var mezo = document.getElementById("eladasMennyiseg");
        var mennyiseg = ervenyesSzamEllenorzes(mezo.value);
        if (mennyiseg === null) {
            return;
        }

        if (mennyiseg > reszveny) {
            document.getElementById("hiba").textContent = "Nincs ennyi részvényed!";
            return;
        }

        penz = penz + mennyiseg * aktualisAr;
        reszveny = reszveny - mennyiseg;
        maiEladas = maiEladas + mennyiseg;

        document.getElementById("hiba").textContent = "";
        mezo.value = "";
        kijelzesFrissites();
        celEllenorzes();
    });

    // ---------- Következő nap gomb ----------
    document.getElementById("kovetkezoNap").addEventListener("click", function () {
        var valtozas = utolsoValtozas();

        var b1 = bot1Kereskedes(valtozas);
        var b2 = bot2Kereskedes();
        var b3 = bot3Kereskedes(valtozas);

        var osszesVetel = maiVetel + b1.vetel + b2.vetel + b3.vetel;
        var osszesEladas = maiEladas + b1.eladas + b2.eladas + b3.eladas;
        var nettoMennyiseg = osszesVetel - osszesEladas;

        var ujAr = ujArfolyamSzamitas(aktualisAr, nettoMennyiseg);

        arfolyamTortenet.push(ujAr);
        aktualisAr = ujAr;

        // uj nap, nullazzuk a mai szamlalokat
        maiVetel = 0;
        maiEladas = 0;

        document.getElementById("hiba").textContent = "";
        grafikonFrissites();
        kijelzesFrissites();
        celEllenorzes();
    });

});
