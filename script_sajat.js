/* ===================================================================
   TŐZSDE SZIMULÁCIÓ – script_sajat.js
   Mit csinál ez a fájl?
   - Kezeli a játékos pénzét és részvényeit (vásárlás / eladás).
   - A "Következő nap" gombra kiszámolja az új árfolyamot.
   - 3 láthatatlan "bot" is kereskedik, hogy élethűbb legyen az ár.
   - Frissíti a grafikon oszlopait (magasság + zöld/piros szín).
   - Kamatos kamat kalkulátor (9. rész).
   - Valuta váltó: az árfolyamokat az internetről kéri le (10. rész).
   =================================================================== */


/* ------------------------------------------------------------------
   1. ALAP BEÁLLÍTÁSOK ÉS ÁLLAPOT (változók)
   A "let" azt jelenti, hogy a változó értéke később megváltozhat.
   ------------------------------------------------------------------ */

let kezdo_ar = 2000; //innen kezdődik a részvény érfolyama
let arvaldozas_szorzo = 5;      // minden 1 db nettó (vétel - eladás) különbség ennyi Ft-tal mozgatja az árat
let grafikon_nagyitas = 10;     // ennyiszer nagyobbnak látszik az árváltozás a grafikonon
let regisztralasi_kuszob = 5;   // ennél kisebb (Ft) napi változást a botok "nem vesznek észre"
let nagy_ugras = 30;            // az 1. botnak ennél nagyobb (Ft) változás számít nagy ugrásnak
let cel_osszeg = 50000;         // ennyi összvagyonnál nyer a játékos
let penz = 20000;               // a játékos pénze (Ft)
let reszveny = 10;              // a játékos részvényeinek száma (db)
let aktualis_ar = kezdo_ar;     // a részvény mai ára (induláskor a kezdő ár)
let arfolyam_tortenet = [];     // lista: az eddigi napok árai, a legutolsó elem a mai ár
let mai_vetel = 0;              // mennyit vett a játékos ma (db) – ez számít bele a holnapi árba
let mai_eladas = 0;             // mennyit adott el a játékos ma (db)


// A 3 bot rejtett adatai (a játékosnak ebből semmi nem látszik).

// 1. bot: minden nap vesz, nagy ugrásnál elad
let bot1Penz = 50000;
let bot1Reszveny = 20;

// 2. bot: óvatos, 3 napos esésnél elad, de mindig hagy bent 10 db-ot
let bot2Penz = 10000;
let bot2Reszveny = 40;

// 3. bot: merész, 5 esés után minden pénzéből vesz, nyereségnél mindent elad
let bot3Penz = 30000;
let bot3Reszveny = 0;
let bot3VanReszvenye = false;   // false = készpénzben vár, true = már vett részvényt és profitra vár
let bot3VetelAr = 0;            // mennyiért vette a részvényeit (hogy tudja, mikor van nyereségben)
let bot3EsesSzamlalo = 0;       // hány egymás utáni esést látott már


/* ------------------------------------------------------------------
   2. KIJELZÉS FRISSÍTÉSE
   A változók értékét kiírja az oldalra, a megfelelő elemekbe.
   Ezt kell meghívni minden olyan változás után, ami látszik az oldalon.
   ------------------------------------------------------------------ */

function kijelzes_frissites() {
    // getElementById: megkeresi az elemet az id-ja alapján
    // textContent: az elem szövegét állítja be
    document.getElementById("ertek").textContent = aktualis_ar;        // a részvény ára a grafikon felett
    document.getElementById("penz").textContent = penz;                // a pénzed
    document.getElementById("reszveny").textContent = reszveny;        // a részvényeid száma
    document.getElementById("reszvenyErtek").textContent = reszveny * aktualis_ar; // a részvényeid összértéke
}


/* ------------------------------------------------------------------
   3. BEMENET ELLENŐRZÉSE
   Megnézi, hogy amit a felhasználó beírt, az pozitív szám-e.
   Ha igen: visszaadja a számot. Ha nem: kiírja a hibát és null-t ad vissza
   (a null azt jelzi a hívó kódnak, hogy "hiba volt, ne csinálj semmit").

   Két elhagyható (opcionális) paramétere van, hogy a kamatos kamat és a
   valuta váltó is használhassa:
     hiba_id    – melyik elembe írja a hibaüzenetet (alapból "hiba", a játék hibahelye)
     egesz_kell – true: csak egész szám fogadható el (alapból); false: tizedes is jó
   Ha ezeket nem adjuk meg, pontosan úgy működik, mint eddig, ezért a
   vásárlás és eladás gomboknál semmit nem kellett átírni.
   ------------------------------------------------------------------ */

function ervenyes_szam_ellenorzes(szoveg, hiba_id, egesz_kell) {
    // Ha nem adtunk meg hiba_id-t (undefined), a játék hibahelyére ír, mint eddig.
    if (hiba_id === undefined) {
        hiba_id = "hiba";
    }
    // Ha nem adtunk meg egesz_kell-t, egész számot vár, mint eddig.
    if (egesz_kell === undefined) {
        egesz_kell = true;
    }

    // 1) üres mező
    if (szoveg == "") {
        document.getElementById(hiba_id).textContent = "Hibás bemenet, csak pozitív szám adható meg!";
        return null;
    }
    // A beviteli mező értéke mindig szöveg, ezért számmá alakítjuk.
    let szam = Number(szoveg);

    // 2) nem szám (isNaN = "is Not a Number") VAGY nulla / negatív
    if (isNaN(szam) || szam <= 0) {
        document.getElementById(hiba_id).textContent = "Hibás bemenet, csak pozitív szám adható meg!";
        return null;
    }

    // 3) tizedes tört: ha a lefelé kerekített érték eltér az eredetitől, nem egész.
    // Ezt csak akkor nézzük, ha egész számot kérünk (egesz_kell === true).
    if (egesz_kell && Math.floor(szam) !== szam) {
        document.getElementById(hiba_id).textContent = "Hibás bemenet, csak pozitív egész szám adható meg!";
        return null;
    }

    // Minden rendben, jó szám.
    return szam;
}


/* ------------------------------------------------------------------
   4. SEGÉDFÜGGVÉNYEK A GRAFIKONHOZ
   ------------------------------------------------------------------ */

// Megkeresi egy lista (tömb) legnagyobb elemét.
function maximum_kereses(tomb) {
    let max = 1;    // 1-ről indul, így sosem lesz 0 (0-val osztani nem lehet)

    // végigmegyünk a lista minden elemén
    for (let i = 0; i < tomb.length; i++) {
        if (tomb[i] > max) {    // ha az aktuális elem nagyobb, ő lesz az új maximum
            max = tomb[i];
        }
    }
    return max;
}

// Kiszámolja egy lista átlagát: összeadja az elemeket, elosztja a darabszámmal.
function atlag_kiszamitas(tomb) {
    let osszeg = 0;

    for (let i = 0; i < tomb.length; i++) {
        osszeg += tomb[i];      // ugyanaz, mint: osszeg = osszeg + tomb[i]
    }
    return osszeg / tomb.length;
}

// Egyetlen oszlop beállítása: magasság és szín.
//   div      – maga az oszlop (HTML elem)
//   ar       – ennek a napnak az ára
//   elozo_ar – az előző nap ára (a színhez kell)
//   max_ar   – a látható árak közül a legnagyobb
//   atlag_ar – a látható árak átlaga
function oszlop_beallitas(div, ar, elozo_ar, max_ar, atlag_ar) {
    // Az oszlop az 50%-os magasságból indul. Ha az ár az átlag fölött van,
    // magasabb lesz, ha alatta, alacsonyabb. A grafikon_nagyitas miatt a
    // kis különbségek is jól látszanak.
    let szazalek = 50 + ((ar - atlag_ar) / max_ar) * 100 * grafikon_nagyitas;

    // Határok: ne lógjon ki a dobozból (100%), és mindig látszódjon (5%).
    if (szazalek > 100) {
        szazalek = 100;
    }
    if (szazalek < 5) {
        szazalek = 5;
    }

    // A számolt százalékot beállítjuk az oszlop magasságának.
    div.style.height = szazalek + "%";

    // Először levesszük a régi színosztályokat (a CSS-ben .zold és .piros)...
    div.classList.remove("zold");
    div.classList.remove("piros");

    // ...majd az előző naphoz képest újat adunk: emelkedés = zöld, esés = piros.
    // (Ha nincs előző nap, vagyis undefined, akkor nincs szín.)
    if (elozo_ar !== undefined) {
        if (ar > elozo_ar) {
            div.classList.add("zold");
        } else if (ar < elozo_ar) {
            div.classList.add("piros");
        }
    }
}

// Az összes oszlop frissítése: 10 múltbeli nap + 1 mai nap = 11 oszlop.
function grafikon_frissites() {
    // A HTML-ben ezek az oszlopok id-i, a legrégebbitől a tegnapiig.
    let nap_nevek = ["10nap", "9nap", "8nap", "7nap", "6nap", "5nap", "4nap", "3nap", "2nap", "1nap"];

    // Csak az utolsó 11 árra van szükség: ennyi oszlop van.
    // (hossz - 11) = az első olyan index, amit még megjelenítünk.
    let kezdo_index = arfolyam_tortenet.length - 11;

    // Ha kevesebb adat van 11-nél, ne menjen negatívba az index.
    if (kezdo_index < 0) {
        kezdo_index = 0;
    }

    // slice: kivágja a listából a kezdo_index-től a végéig tartó részt.
    let lathato_arak = arfolyam_tortenet.slice(kezdo_index);
    let max_ar = maximum_kereses(lathato_arak);
    let atlag_ar = atlag_kiszamitas(lathato_arak);

    // Végigmegyünk a 10 névvel ellátott oszlopon.
    for (let i = 0; i < nap_nevek.length; i++) {
        let elem = document.getElementById(nap_nevek[i]);   // az oszlop HTML eleme

        // Csak akkor állítjuk be, ha az elem létezik és van hozzá adat.
        if (elem && arfolyam_tortenet[i + 1] !== undefined) {
            // lathato_arak[i-1] = az előző nap ára (az első oszlopnál ez nem létezik,
            // ezért annak az oszlopnak nem lesz színe – ez nem hiba, csak egy apróság).
            oszlop_beallitas(elem, lathato_arak[i], lathato_arak[i - 1], max_ar, atlag_ar);
        }
    }

    // A mai oszlop az utolsó, id nélküli div a grafikonban.
    // querySelectorAll: az összes olyan div-et megkeresi, ami a .arfolyam közvetlen gyereke.
    var osszesOszlop = document.querySelectorAll("#szimulacio .arfolyam > div");
    var maiOszlop = osszesOszlop[osszesOszlop.length - 1];      // az utolsó elem a listában
    if (maiOszlop) {
        // A mai oszlop a mai árat mutatja, a "tegnapi" ár az utolsó előtti elem a történetben.
        oszlop_beallitas(maiOszlop, aktualis_ar, arfolyam_tortenet[arfolyam_tortenet.length - 2], max_ar, atlag_ar);
    }
}


/* ------------------------------------------------------------------
   5. ÚJ ÁRFOLYAM SZÁMÍTÁSA
   Ez a "képlet": a nettó vétel/eladás alapján mozdítja el az árat.
   ------------------------------------------------------------------ */

function uj_arfolyam_szamitas(regi_ar, netto_mennyiseg) {
    // Pl. +10 nettó vétel * 5 = +50 Ft; -4 nettó eladás * 5 = -20 Ft.
    let valtozas = netto_mennyiseg * arvaldozas_szorzo;

    let uj_ar = regi_ar + valtozas;

    // Az ár nem mehet 1 Ft alá (nulla vagy negatív ár nem létezik).
    if (uj_ar < 1) {
        uj_ar = 1;
    }

    // Math.floor: lefelé kerekít egész számra (nincs tizedes Ft).
    return Math.floor(uj_ar);
}


/* ------------------------------------------------------------------
   6. SEGÉDFÜGGVÉNYEK A BOTOKHOZ
   ------------------------------------------------------------------ */

// Az utolsó két nap közötti árkülönbség (ez alapján "néznek körül" a botok).
function utolso_valtozas() {
    // Ha még nincs legalább 2 adat, nincs mit összehasonlítani.
    if (arfolyam_tortenet.length < 2) {
        return 0;
    } else {
        // utolsó elem - utolsó előtti elem (a hossz-1 az utolsó index, mert 0-tól számolunk)
        return arfolyam_tortenet[arfolyam_tortenet.length - 1] - arfolyam_tortenet[arfolyam_tortenet.length - 2];
    }
}

// Igaz, ha az utolsó 3 napon mindig volt érdemi (a küszöbnél nagyobb) esés.
function harmas_csokkenes_ellenorzes() {
    // 3 változáshoz 4 adat kell.
    if (arfolyam_tortenet.length < 4) {
        return false;
    }
    // v1 = tegnapi változás, v2 = az azelőtti, v3 = az még azelőtti
    let v1 = arfolyam_tortenet[arfolyam_tortenet.length - 1] - arfolyam_tortenet[arfolyam_tortenet.length - 2];
    let v2 = arfolyam_tortenet[arfolyam_tortenet.length - 2] - arfolyam_tortenet[arfolyam_tortenet.length - 3];
    let v3 = arfolyam_tortenet[arfolyam_tortenet.length - 3] - arfolyam_tortenet[arfolyam_tortenet.length - 4];

    // Mindhárom negatív és a küszöbnél is nagyobb mértékű (pl. kisebb, mint -5)?
    if (v1 < -regisztralasi_kuszob && v2 < -regisztralasi_kuszob && v3 < -regisztralasi_kuszob) {
        return true;
    }
    return false;
}


/* ------------------------------------------------------------------
   7. A BOTOK
   Mindegyik bot egy {vetel: ..., eladas: ...} objektumot ad vissza:
   mennyit vett és mennyit adott el aznap. Közben a saját pénzét és
   részvényeit is frissíti, hogy sose menjenek mínuszba.
   ------------------------------------------------------------------ */

// --- 1. bot: minden nap vesz, nagy ugrásnál elad ---
function bot1Kereskedes(valtozas) {
    var vetelDb = 0;    // ma ennyit vesz
    var eladasDb = 0;   // ma ennyit ad el

    if (Math.abs(valtozas) > nagy_ugras) {
        // Math.abs = abszolút érték (előjel nélkül). Nagy ugrás (fel vagy le) -> elad 5-öt.
        eladasDb = 5;
    } else if (Math.abs(valtozas) <= regisztralasi_kuszob) {
        // Szinte semmi nem változott -> 5 helyett 10-et vesz.
        vetelDb = 10;
    } else {
        // Átlagos nap -> a megszokott napi 5 db-ot veszi.
        vetelDb = 5;
    }

    // Védelem: ne adjon el többet, mint amennyije van.
    if (eladasDb > bot1Reszveny) {
        eladasDb = bot1Reszveny;
    }
    // Védelem: ne vegyen többet, mint amennyit a pénzéből ki tud fizetni.
    if (vetelDb * aktualis_ar > bot1Penz) {
        vetelDb = Math.floor(bot1Penz / aktualis_ar);
    }

    // A bot pénzének és részvényeinek frissítése.
    bot1Penz = bot1Penz - vetelDb * aktualis_ar + eladasDb * aktualis_ar;
    bot1Reszveny = bot1Reszveny + vetelDb - eladasDb;

    // Visszaadjuk, mennyit vett/adott el (ez kell az ár kiszámolásához).
    return { vetel: vetelDb, eladas: eladasDb };
}

// --- 2. bot: óvatos, 3 napos esés után elad, de mindig marad nála 10 db ---
function bot2Kereskedes() {
    var vetelDb = 0;
    var eladasDb = 0;

    if (harmas_csokkenes_ellenorzes()) {
        // 3 napja csak esik az ár: nem vesz, csak elad, kb. 5-8 db-ot
        // (Math.random() 0 és 1 közötti véletlen szám, *4 majd lefelé kerekítve: 0-3, +5 = 5-8).
        var mennyit = 5 + Math.floor(Math.random() * 4);
        // Mindig hagyjon bent legalább 10 részvényt.
        if (bot2Reszveny - mennyit < 10) {
            mennyit = bot2Reszveny - 10;
        }
        // Ha ettől negatív lenne, akkor ne adjon el semmit.
        if (mennyit < 0) {
            mennyit = 0;
        }
        eladasDb = mennyit;
    } else {
        // Nincs 3 napos esés: kis véletlen mennyiséggel (1-5 db) kereskedik.
        var random_mennyiseg = 1 + Math.floor(Math.random() * 5);
        if (Math.random() < 0.5) {
            // 50% eséllyel vesz, de csak ha van rá pénze.
            if (random_mennyiseg * aktualis_ar <= bot2Penz) {
                vetelDb = random_mennyiseg;
            }
        } else {
            // 50% eséllyel elad, de csak ha utána még marad legalább 10 db-ja.
            if (bot2Reszveny - random_mennyiseg >= 10) {
                eladasDb = random_mennyiseg;
            }
        }
    }

    bot2Penz = bot2Penz - vetelDb * aktualis_ar + eladasDb * aktualis_ar;
    bot2Reszveny = bot2Reszveny + vetelDb - eladasDb;

    return { vetel: vetelDb, eladas: eladasDb };
}

// --- 3. bot: merész; 5 esés után mindent bevet, nyereségnél mindent elad ---
function bot3Kereskedes(valtozas) {
    var vetelDb = 0;
    var eladasDb = 0;
    // Csak akkor "érzékeli" a változást, ha az nagyobb a küszöbnél (true / false).
    var jelentosValtozas = Math.abs(valtozas) > regisztralasi_kuszob;

    if (bot3VanReszvenye) {
        // --- Van részvénye, arra vár, hogy nyereségben legyen ---
        if (aktualis_ar > bot3VetelAr) {
            // Többet ér, mint amennyiért vette -> mindent eladja.
            eladasDb = bot3Reszveny;
            bot3VanReszvenye = false;   // újra készpénzben van
            bot3EsesSzamlalo = 0;
        } else if (Math.random() < 0.2) {
            // 20% eséllyel akkor is elad egy keveset (1-3 db), hogy élethűbb legyen.
            var kicsi1 = 1 + Math.floor(Math.random() * 3);
            if (kicsi1 <= bot3Reszveny) {
                eladasDb = kicsi1;
            }
        }
    } else {
        // --- Készpénzben van, a mélypontra vár ---
        if (jelentosValtozas && valtozas < 0) {
            // Érdemi esés volt: számoljuk az egymás utáni eséseket.
            bot3EsesSzamlalo = bot3EsesSzamlalo + 1;
        } else if (jelentosValtozas && valtozas > 0) {
            // Emelkedés volt: az eséssorozat megszakadt, kezdi újra a számolást.
            bot3EsesSzamlalo = 0;
        }

        if (bot3EsesSzamlalo >= 5) {
            // 5 esés után szerinte már nem mehet lejjebb: az összes pénzéből vesz.
            vetelDb = Math.floor(bot3Penz / aktualis_ar);
            if (vetelDb > 0) {
                bot3VetelAr = aktualis_ar;      // megjegyzi, mennyiért vett
                bot3VanReszvenye = true;
            }
            bot3EsesSzamlalo = 0;
        } else if (!jelentosValtozas && Math.random() < 0.3) {
            // Ha nincs érdemi változás, 30% eséllyel vesz egy keveset (1-3 db).
            var kicsi2 = 1 + Math.floor(Math.random() * 3);
            if (kicsi2 * aktualis_ar <= bot3Penz) {
                vetelDb = kicsi2;
            }
        }
    }

    bot3Penz = bot3Penz - vetelDb * aktualis_ar + eladasDb * aktualis_ar;
    bot3Reszveny = bot3Reszveny + vetelDb - eladasDb;

    return { vetel: vetelDb, eladas: eladasDb };
}


/* ------------------------------------------------------------------
   8. NYERÉS / VERESÉG ELLENŐRZÉSE
   ------------------------------------------------------------------ */

function cel_ellenorzes() {
    let teljesVagyon = penz + reszveny * aktualis_ar;     // összvagyon = készpénz + részvények értéke
    if (teljesVagyon >= cel_osszeg) {
        alert("Gratulálok! Elérted a célösszeget!");
    } else if (penz <= 0 && reszveny <= 0) {
        // Se pénz, se részvény -> vesztettél.
        alert("Sajnálom, de elvesztetted az összes pénzed és részvényed. Csődbe mentél!");
    }
}


/* ------------------------------------------------------------------
   9. KAMATOS KAMAT KALKULÁTOR
   ------------------------------------------------------------------ */

// Kiszámolja, mennyi lesz a végösszeg kamatos kamattal.
//   kezdo  – a kezdő összeg (Ft)
//   kamat  – az ÉVES kamatláb százalékban (pl. 5 jelent 5%-ot)
//   ido    – a futamidő (szám)
//   egyseg – "ev" vagy "honap" (a legördülő menü értéke)
function kamatos_kamat_szamitas(kezdo, kamat, ido, egyseg) {
    // A kamatláb éves, ezért a hónapokat évekre váltjuk (12 hónap = 1 év).
    let evek = ido;
    if (egyseg === "honap") {
        evek = ido / 12;
    }

    // A százalékot szorzóvá alakítjuk: 5% -> 1.05
    let szorzo = 1 + kamat / 100;

    // Kamatos kamat képlete: végösszeg = kezdő összeg * szorzó ^ évek
    // Math.pow(alap, kitevő) = hatványozás (pl. Math.pow(2, 3) = 8)
    return kezdo * Math.pow(szorzo, evek);
}


/* ------------------------------------------------------------------
   10. VALUTA VÁLTÓ
   Az árfolyamokat egy ingyenes internetes szolgáltatástól (exchange-api)
   kérjük le, így mindig a legfrissebb árfolyam alapján számol.
   ------------------------------------------------------------------ */

// A szolgáltatás címei. A cím végére a kezdő valuta kódja és a ".json" kerül,
// pl. ".../currencies/eur.json" = az euróhoz képesti árfolyamok.
// Két cím van, mert a szolgáltatás készítője azt kéri, legyen tartalék:
// ha az első nem válaszol, megpróbáljuk a másodikat.
let valuta_api_cimek = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/",
    "https://latest.currency-api.pages.dev/v1/currencies/"
];

// Lekéri az árfolyamokat a megadott kezdő valutához képest.
// Az "async" azt jelenti, hogy a függvény várakozhat az internetre (ez időbe
// telik), és közben az oldal nem fagy le. Az "await" ott áll, ahol meg kell
// várni az eredményt, mielőtt a kód megy tovább.
// Visszaad: az árfolyam-adatokat, vagy null-t, ha egyik cím sem működött.
async function arfolyamok_lekerese(kezdo_kod) {
    // Végigmegyünk a címeken: az elsőt próbáljuk, ha nem sikerül, jön a következő.
    for (let i = 0; i < valuta_api_cimek.length; i++) {
        // try/catch: ha hiba történik (pl. nincs internet), a program nem áll
        // le, hanem a catch ágra ugrik.
        try {
            // fetch: elkéri az adatot a címről. Az await megvárja a választ.
            let valasz = await fetch(valuta_api_cimek[i] + kezdo_kod + ".json");

            // valasz.ok = true, ha a szerver rendben válaszolt.
            if (valasz.ok) {
                // A válasz szöveges (JSON), a .json() ebből csinál objektumot.
                return await valasz.json();
            }
        } catch (hiba) {
            // Ez a cím nem működött. Nem csinálunk semmit, a ciklus
            // a következő címmel próbálkozik.
        }
    }
    // Egyik cím sem működött.
    return null;
}


/* ------------------------------------------------------------------
   11. INDÍTÁS ÉS GOMBOK
   A DOMContentLoaded esemény akkor fut le, amikor az oldal HTML-je
   betöltődött. Így biztos, hogy az elemek már léteznek, mire keressük őket.
   ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", function () {
    // Az árfolyam-történetet feltöltjük 11 db kezdőárral, hogy a grafikon
    // már induláskor teljesen ki legyen töltve.
    for (let i = 0; i < 11; i++) {
        arfolyam_tortenet.push(kezdo_ar);   // push: hozzáadja a lista végéhez
    }

    // Első kirajzolás: számok és grafikon.
    kijelzes_frissites();
    grafikon_frissites();

    // ---------- VÁSÁRLÁS gomb ----------
    // addEventListener("click", ...): ha rákattintanak a gombra, lefut a függvény.
    document.getElementById("vasarlas").addEventListener("click", function () {
        let mezo = document.getElementById("vasarlasMennyiseg");    // a beviteli mező

        // mezo.value = amit a felhasználó beírt (szövegként). Ellenőrizzük.
        let mennyiseg = ervenyes_szam_ellenorzes(mezo.value);

        // null = hibás bemenet, a hibát már kiírta a függvény -> kilépünk.
        if (mennyiseg === null) {
            return;
        }

        // Mennyibe kerül összesen?
        let koltseg = mennyiseg * aktualis_ar;

        // Van-e rá elég pénz?
        if (koltseg > penz) {
            document.getElementById("hiba").textContent = "Nincs elég pénzed ehhez a vásárláshoz!";
            return;
        }

        penz -= koltseg;          // levonjuk a pénzből
        reszveny += mennyiseg;       // hozzáadjuk a részvényekhez
        mai_vetel += mennyiseg;      // feljegyezzük a mai vételek közé (ez számít a holnapi árba)

        document.getElementById("hiba").textContent = "";    // régi hibaüzenet törlése
        mezo.value = "";                                    // beviteli mező kiürítése

        kijelzes_frissites();       // az új számok kiírása
        cel_ellenorzes();           // megnézzük, nyert/vesztett-e
    })

    // ---------- ELADÁS gomb ----------
    document.getElementById("eladas").addEventListener("click", function () {
        let mezo = document.getElementById("eladasMennyiseg");

        let mennyiseg = ervenyes_szam_ellenorzes(mezo.value);

        if (mennyiseg === null) {
            return;
        }

        // Nem adhatsz el többet, mint amennyid van.
        if (mennyiseg > reszveny) {
            document.getElementById("hiba").textContent = "Nincs ennyi részvényed!";
            return;
        }

        penz += mennyiseg * aktualis_ar;    // megkapod a pénzt az eladásért
        reszveny -= mennyiseg;              // kevesebb részvényed lesz
        mai_eladas += mennyiseg;            // feljegyezzük a mai eladások közé

        document.getElementById("hiba").textContent = "";
        mezo.value = "";

        kijelzes_frissites();
        cel_ellenorzes();
    })

    // ---------- KÖVETKEZŐ NAP gomb ----------
    // Itt dől el az új árfolyam: a te mai kereskedésed + a 3 bot döntése alapján.
    document.getElementById("kovetkezoNap").addEventListener("click", function () {
        // Az utolsó lezárt változás: ez alapján döntenek a botok.
        let valtozas = utolso_valtozas();

        // Mindhárom bot megcsinálja a mai kereskedését.
        let b1 = bot1Kereskedes(valtozas);
        let b2 = bot2Kereskedes();
        let b3 = bot3Kereskedes(valtozas);

        // Összesítjük a mai vételeket és eladásokat (játékos + 3 bot).
        let osszes_vetel = mai_vetel + b1.vetel + b2.vetel + b3.vetel;
        let osszes_eladas = mai_eladas + b1.eladas + b2.eladas + b3.eladas;

        // Nettó = vétel - eladás. Ha pozitív, nőni fog az ár, ha negatív, esni.
        let netto_mennyiseg = osszes_vetel - osszes_eladas;
        let uj_ar = uj_arfolyam_szamitas(aktualis_ar, netto_mennyiseg);
        aktualis_ar = uj_ar;                // ez lesz a mai ár
        arfolyam_tortenet.push(uj_ar);      // és bekerül a történetbe is

        // Új nap kezdődik: nullázzuk a mai számlálókat.
        mai_vetel = 0;
        mai_eladas = 0;

        document.getElementById("hiba").textContent = "";
        kijelzes_frissites();       // számok frissítése
        grafikon_frissites();       // oszlopok frissítése
        cel_ellenorzes();           // nyert/vesztett?
    })

    // ---------- KAMATOS KAMAT: SZÁMOL gomb ----------
    document.getElementById("szamol").addEventListener("click", function () {
        // Új számolás előtt töröljük a régi hibát és nullázzuk az eredményt.
        document.getElementById("hibas").textContent = "";
        document.getElementById("vegOsszeg").textContent = "0";

        // A három mezőt egyenként ellenőrizzük a már meglévő függvénnyel.
        // A "hibas" azt jelenti, hogy a hibát a kamatos kamat saját hibahelyére
        // írja (nem a játékéba). A harmadik érték: egész szám kell-e?
        // A kezdő összegnél és a kamatlábnál lehet tizedes (pl. 3.5%),
        // a futamidőnél csak egész.
        let kezdo = ervenyes_szam_ellenorzes(document.getElementById("kezdoOsszeg").value, "hibas", false);
        if (kezdo === null) {
            return;
        }

        let kamat = ervenyes_szam_ellenorzes(document.getElementById("kamatlab").value, "hibas", false);
        if (kamat === null) {
            return;
        }

        let ido = ervenyes_szam_ellenorzes(document.getElementById("idoszak").value, "hibas", true);
        if (ido === null) {
            return;
        }

        // Év vagy hónap? (a legördülő menü értéke: "ev" vagy "honap")
        let egyseg = document.getElementById("hossz").value;

        let vegosszeg = kamatos_kamat_szamitas(kezdo, kamat, ido, egyseg);

        // Ha a szám túl nagy, a JavaScript Infinity-t (végtelent) ad.
        // isFinite: véges szám-e? Ha nem, nem tudjuk kiírni.
        if (!isFinite(vegosszeg)) {
            document.getElementById("hibas").textContent = "Túl nagy számok, ezt nem tudom kiszámolni!";
            return;
        }

        // Kerekítés egész forintra, és magyar számformázás (ezres elválasztóval).
        document.getElementById("vegOsszeg").textContent = Math.round(vegosszeg).toLocaleString("hu-HU");
    })

    // ---------- VALUTA VÁLTÁS gomb ----------
    // Az "async" kell ide, mert a függvényben "await"-et használunk
    // (megvárjuk, amíg az internetről megjön az árfolyam).
    // FONTOS: a HTML-ben a hibaüzenet helyének id="valuta_hiba"-nak kell lennie.
    document.getElementById("valuta_valtas").addEventListener("click", async function () {
        let gomb = document.getElementById("valuta_valtas");
        let eredmeny_hely = document.getElementById("valuta_eredmeny");
        let hiba_hely = document.getElementById("valuta_hiba");

        // Új váltás előtt töröljük a régi eredményt és hibát.
        eredmeny_hely.textContent = "";
        eredmeny_hely.removeAttribute("data-datum");    // az árfolyam dátuma (a CSS jeleníti meg az eredmény alatt)
        hiba_hely.textContent = "";

        // 1) Az összeg ellenőrzése: pozitív szám, tizedes is lehet (pl. 12.5 euró).
        // A "valuta_hiba" azt jelenti, hogy a hibát a valuta váltó hibahelyére írja.
        let osszeg = ervenyes_szam_ellenorzes(document.getElementById("valuta_osszeg").value, "valuta_hiba", false);
        if (osszeg === null) {
            return;
        }

        // 2) Melyik valutából melyikbe váltunk? A legördülő menük értéke a kisbetűs
        // valutakód (pl. "huf", "eur"), a látható szöveg pedig a név (pl. "Forint").
        let kezdo_select = document.getElementById("kezdo_valuta");
        let cel_select = document.getElementById("cel_valuta");
        let kezdo_kod = kezdo_select.value;
        let cel_kod = cel_select.value;
        let kezdo_nev = kezdo_select.options[kezdo_select.selectedIndex].text;
        let cel_nev = cel_select.options[cel_select.selectedIndex].text;

        let arfolyam = 1;   // alapból 1: ha ugyanabba a valutába váltunk, nincs mit számolni
        let datum = "";     // az árfolyam dátuma (csak akkor lesz, ha lekértük az internetről)

        // 3) Ha két különböző valuta van kiválasztva, lekérjük az árfolyamot.
        if (kezdo_kod !== cel_kod) {
            // Amíg tart a lekérés, jelezzük, és letiltjuk a gombot, hogy
            // ne lehessen többször egymás után rákattintani.
            eredmeny_hely.textContent = "Árfolyam lekérése...";
            gomb.disabled = true;

            let adatok = await arfolyamok_lekerese(kezdo_kod);

            gomb.disabled = false;
            eredmeny_hely.textContent = "";

            // null = egyik cím sem válaszolt (pl. nincs internet).
            if (adatok === null) {
                hiba_hely.textContent = "Nem sikerült lekérni az árfolyamot. Ellenőrizd az internetkapcsolatot, és próbáld újra!";
                return;
            }

            // Az adatok így néznek ki: { date: "2026-10-02", eur: { huf: 368.86, usd: 1.12, ... } }
            // Tehát a keresett árfolyam: adatok[kezdo_kod][cel_kod]
            // Biztonságból megnézzük, hogy tényleg benne van-e.
            if (adatok[kezdo_kod] === undefined || adatok[kezdo_kod][cel_kod] === undefined) {
                hiba_hely.textContent = "Ehhez a valutapárhoz most nincs árfolyam.";
                return;
            }

            arfolyam = adatok[kezdo_kod][cel_kod];
            datum = adatok.date;
        }

        // 4) Átszámolás.
        let eredmeny = osszeg * arfolyam;

        // Hány tizedesjegyet írjunk ki? Alapból 2, de ha az eredmény 1-nél kisebb
        // (pl. 1 forint euróban), akkor 6, különben 0,00-nak látszana.
        let tizedes = 2;
        if (eredmeny < 1) {
            tizedes = 6;
        }

        // toLocaleString("hu-HU", ...): magyar számformázás (szóköz az ezreseknél,
        // vessző a tizedesnél). A beállításokban megadjuk a tizedesjegyek számát.
        let eredmeny_szoveg = eredmeny.toLocaleString("hu-HU", { minimumFractionDigits: 2, maximumFractionDigits: tizedes });

        // Kiírás, pl.: 1 000 Forint = 2,71 Euró
        eredmeny_hely.textContent = osszeg.toLocaleString("hu-HU") + " " + kezdo_nev + " = " + eredmeny_szoveg + " " + cel_nev;

        // Ha volt lekérés, az árfolyam dátumát is megjegyezzük az elemen
        // (data-datum), a CSS ezt írja ki kisebb betűvel az eredmény alá.
        if (datum !== "") {
            eredmeny_hely.setAttribute("data-datum", "Árfolyam dátuma: " + datum);
        }
    })
})



/* ------- Részvény árfolyam ------*/
let alpha_vantage_kulcs = "7N7NQQLSN4A4XWEO";


let reszveny_napok_szama = 14;      // ennyi oszlop van a grafikonon (a legfrissebb nappal együtt)


// Kiír egy üzenetet a grafikon alá. Ha még nincs ilyen hely, létrehozza.
//   szoveg  – amit kiírunk (üres szöveg: törli az üzenetet)
//   hiba_e  – true, ha hibaüzenet (akkor sárga lesz), egyébként sima tájékoztató sor
function reszveny_uzenet(szoveg, hiba_e) {
    let hely = document.getElementById("reszveny_info");

    if (hely === null) {
        // createElement: új HTML elemet készít, insertAdjacentElement("afterend", ...):
        // a grafikon doboza UTÁN teszi be. Így a HTML-t nem kell módosítani.
        hely = document.createElement("span");
        hely.id = "reszveny_info";
        let doboz = document.getElementById("reszveny_valasztas").parentElement;
        doboz.insertAdjacentElement("afterend", hely);
    }

    hely.textContent = szoveg;

    if (hiba_e === true) {
        hely.classList.add("hiba");     // a CSS-ben a .hiba osztály adja a sárga színt
    } else {
        hely.classList.remove("hiba");
    }
}

// Megkeresi egy lista legkisebb elemét (a maximum_kereses párja).
function minimum_kereses(tomb) {
    let min = tomb[0];

    for (let i = 1; i < tomb.length; i++) {
        if (tomb[i] < min) {
            min = tomb[i];
        }
    }
    return min;
}

// Hány %-os magas legyen egy oszlop? A legalacsonyabb ár 15%-os, a legmagasabb
// 100%-os oszlop lesz, a többi ezek között (arányosan).
// Itt NEM az oszlop_beallitas()-t használjuk, mert az a szimuláció kicsi
// árváltozásaihoz van kitalálva (10x nagyítás az átlaghoz képest). A valódi
// részvények többet mozognak, ezért ez a min-max skála a jobb.
function reszveny_szazalek(ar, min_ar, max_ar) {
    if (max_ar > min_ar) {
        return 15 + ((ar - min_ar) / (max_ar - min_ar)) * 85;
    }
    return 100;     // ha minden ár egyforma, minden oszlop teljes magasságú
}

// Az előző fordítottja: melyik ár tartozik egy adott magassághoz (%)?
// A bal oldali #ar_kozep felirathoz kell (az 50%-os magasság ára).
function reszveny_ar_szazalekhoz(szazalek, min_ar, max_ar) {
    return min_ar + ((szazalek - 15) / 85) * (max_ar - min_ar);
}

// Egy ár szépen kiírva: 87 950 Ft
function reszveny_ar_szoveg(ar) {
    return Math.round(ar).toLocaleString("hu-HU") + " Ft";
}

// A két bal oldali felirat (#ar_max és #ar_kozep) beállítása.
// Ha nem kapnak árat (min_ar és max_ar nélkül hívjuk), kiürülnek és eltűnnek.
function reszveny_feliratok(min_ar, max_ar) {
    let felso = document.getElementById("ar_max");
    let kozep = document.getElementById("ar_kozep");

    if (min_ar === undefined || max_ar === undefined) {
        felso.textContent = "";
        kozep.textContent = "";
        return;
    }

    // A legmagasabb oszlop 100%-os, a felirat a CSS-ben pont a tetejéhez van igazítva.
    felso.textContent = reszveny_ar_szoveg(max_ar);

    // A középső felirat az 50%-os magassághoz tartozó árat mutatja.
    // (Ha minden ár egyforma, nincs mit mutatni, ilyenkor üres marad.)
    if (max_ar > min_ar) {
        kozep.textContent = reszveny_ar_szoveg(reszveny_ar_szazalekhoz(50, min_ar, max_ar));
    } else {
        kozep.textContent = "";
    }
}

// Egyetlen oszlop beállítása: magasság, szín és a rámutatáskor megjelenő szöveg.
//   div      – maga az oszlop
//   datum    – a nap dátuma (pl. "2026-10-09")
//   ar       – ennek a napnak a záróára forintban
//   elozo_ar – az előző nap záróára (a színhez kell)
//   min_ar   – a 14 nap legkisebb ára
//   max_ar   – a 14 nap legnagyobb ára
function reszveny_oszlop_beallitas(div, datum, ar, elozo_ar, min_ar, max_ar) {
    div.style.height = reszveny_szazalek(ar, min_ar, max_ar) + "%";

    // Régi szín le, új szín fel (a CSS-ben már meglévő .zold és .piros osztályok).
    div.classList.remove("zold");
    div.classList.remove("piros");

    if (ar > elozo_ar) {
        div.classList.add("zold");
    } else if (ar < elozo_ar) {
        div.classList.add("piros");
    }

    // A title attribútum az egér fölé vitelkor jelenik meg kis szövegként.
    div.title = datum + ": " + reszveny_ar_szoveg(ar);
}

// Lekéri egy részvény napi záróárait az Alpha Vantage-tól (dollárban).
// Fontos: az Alpha Vantage napi (TIME_SERIES_DAILY) lekérése egyszerre csak EGY részvényt
// ad vissza, több részvény egy kéréssel csak prémium előfizetéssel kérhető (és csak a
// mai árat adja, múltbeli napokat nem). Ezért itt részvényenként külön lekérés van,
// de minden részvényt naponta csak egyszer kérünk le, utána a mentett adatot használjuk.
// Visszaad:
//   { nap, datumok, arak }  ha sikerült  (15 adat: a 14 oszlop + az előtte lévő nap a színhez)
//   { hiba: "szöveg" }      ha nem sikerült
async function alpha_vantage_lekeres(kod) {
    // A mai dátum (pl. "2026-10-10"): az egyszer már lekért adatot a nap végéig megjegyezzük.
    let ma = new Date().toISOString().slice(0, 10);
    let mentes_neve = "av_" + kod;

    // 1) Volt már ma lekérve ez a részvény? Akkor nem kérjük le újra.
    // A try/catch azért kell, mert a localStorage néha nem elérhető (pl. privát ablak).
    try {
        let mentett = localStorage.getItem(mentes_neve);
        if (mentett !== null) {
            let mentett_adat = JSON.parse(mentett);
            if (mentett_adat.nap === ma) {
                return mentett_adat;
            }
        }
    } catch (hiba) {
        // Nem baj, akkor lekérjük az internetről.
    }

    // 2) Be van írva a kulcs?
    if (alpha_vantage_kulcs === "IDE_IRD_A_KULCSOD") {
        return { hiba: "Nincs beállítva az API kulcs: írd be a script.js-ben az alpha_vantage_kulcs változóba." };
    }

    // 3) Lekérés. A function=TIME_SERIES_DAILY a napi adatokat adja,
    // az outputsize alapból "compact" (a legutolsó 100 nap), ez az ingyenes kulccsal is megy.
    let adatok;
    try {
        let valasz = await fetch("https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=" + kod + "&apikey=" + alpha_vantage_kulcs);
        adatok = await valasz.json();
    } catch (hiba) {
        return { hiba: "Nem sikerült lekérni az árfolyamot. Ellenőrizd az internetkapcsolatot, és próbáld újra!" };
    }

    // 4) A válaszban a napi adatok a "Time Series (Daily)" kulcs alatt vannak.
    // Ha ez hiányzik, valami baj van (pl. elfogyott a napi keret): megnézzük, mit írt a szolgáltatás.
    let sorozat = adatok["Time Series (Daily)"];

    if (sorozat === undefined) {
        console.log("Alpha Vantage válasz:", adatok);    // F12 -> Console: itt látod az eredeti üzenetet

        if (adatok["Error Message"] !== undefined) {
            return { hiba: "Ehhez a részvényhez nem találtam adatot." };
        }
        return { hiba: "Az Alpha Vantage most nem adott adatot: valószínűleg elfogyott a mai 25 lekérés, vagy hibás az API kulcs." };
    }

    // 5) A dátumok a sorozat kulcsai (pl. "2026-10-09"). Sorba rendezzük őket a legrégebbitől
    // a legújabbig, és az utolsó 15-öt tartjuk meg (14 oszlop + az első oszlop előtti nap).
    let datumok = Object.keys(sorozat);
    datumok.sort();

    if (datumok.length < reszveny_napok_szama + 1) {
        return { hiba: "Ehhez a részvényhez nincs elég adat." };
    }

    datumok = datumok.slice(-(reszveny_napok_szama + 1));

    // 6) A záróár a "4. close" mező, szövegként érkezik, ezért számmá alakítjuk.
    let arak = [];
    for (let i = 0; i < datumok.length; i++) {
        arak.push(Number(sorozat[datumok[i]]["4. close"]));
    }

    let eredmeny = { nap: ma, datumok: datumok, arak: arak };

    // 7) Megjegyezzük mára.
    try {
        localStorage.setItem(mentes_neve, JSON.stringify(eredmeny));
    } catch (hiba) {
        // Nem baj, ha nem sikerült elmenteni.
    }

    return eredmeny;
}

// A kiválasztott részvény betöltése és kirajzolása.
async function reszveny_betoltes() {
    let valaszto = document.getElementById("reszveny_valasztas");
    let kod = valaszto.value;                                   // pl. "AAPL"
    let ar_hely = document.getElementById("reszveny_ar");

    reszveny_uzenet("", false);
    reszveny_feliratok();               // a régi felirat eltűnik, amíg az új adat meg nem érkezik
    ar_hely.textContent = "…";

    // Árak dollárban az Alpha Vantage-tól.
    let adat = await alpha_vantage_lekeres(kod);

    // Ha közben másik részvényt választottak, ennek az eredménye már nem kell.
    if (valaszto.value !== kod) {
        return;
    }

    if (adat.hiba !== undefined) {
        ar_hely.textContent = "–";
        reszveny_uzenet(adat.hiba, true);
        return;
    }

    // Dollár-forint árfolyam: a valuta váltónál már megírt függvénnyel.
    let arfolyamok = await arfolyamok_lekerese("usd");

    if (valaszto.value !== kod) {
        return;
    }

    if (arfolyamok === null || arfolyamok["usd"] === undefined || arfolyamok["usd"]["huf"] === undefined) {
        ar_hely.textContent = "–";
        reszveny_uzenet("Nem sikerült lekérni a dollár-forint árfolyamot.", true);
        return;
    }

    let usd_huf = arfolyamok["usd"]["huf"];

    // Átszámolás forintra (mind a 15 árat).
    let ft_arak = [];
    for (let i = 0; i < adat.arak.length; i++) {
        ft_arak.push(adat.arak[i] * usd_huf);
    }

    // Az első elem csak az előző nap (a legelső oszlop színéhez kell),
    // az oszlopokon a többi 14 látszik.
    let lathato = ft_arak.slice(1);
    let min_ar = minimum_kereses(lathato);
    let max_ar = maximum_kereses(lathato);

    // A legrégebbi nap a 14-es oszlop, a legfrissebb az 1-es (a HTML sorrendje szerint).
    for (let i = 0; i < lathato.length; i++) {
        let oszlop = document.getElementById(String(reszveny_napok_szama - i));
        reszveny_oszlop_beallitas(oszlop, adat.datumok[i + 1], lathato[i], ft_arak[i], min_ar, max_ar);
    }

    // A bal oldali két felirat (legmagasabb ár, 50%-os magasság ára).
    reszveny_feliratok(min_ar, max_ar);

    // A legfrissebb ár kiírása, és egy tájékoztató sor.
    ar_hely.textContent = Math.round(lathato[lathato.length - 1]).toLocaleString("hu-HU");
    reszveny_uzenet("Utolsó kereskedési nap: " + adat.datumok[adat.datumok.length - 1] +
        " · " + reszveny_napok_szama + " kereskedési nap, dollárból a mai árfolyamon átszámolva.", false);
}

// Indításkor betöltjük az éppen kiválasztott részvényt, és figyeljük a menüt.
// (Ez egy másik DOMContentLoaded figyelő a meglévő mellett, nem kell összevonni őket.)
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("reszveny_valasztas").addEventListener("change", reszveny_betoltes);
    reszveny_betoltes();
});