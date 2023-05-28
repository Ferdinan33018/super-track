var express = require('express');
const { monitorDNS, extractDomain, monitorHttpRequest, resolve } = require('../utils/monitor.dns');
const { verificarCertificadosSslEmLote } = require('../utils/certificado.validation');
const hosts = require('../utils/hosts');

const geoip = require('geoip-lite');
const { sendBatch2LogStash } = require('../utils/elastic');


var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});


router.get('/monitor', async function (req, res) {

  var arrHosts = hosts.split('\n').map(extractDomain);

  await monitorDNS(arrHosts);
  //await monitorDNS(webAddresses);
  res.json({ message: 'monitoramento em andamento...' });
});

router.get('/teste', async function (req, res) {

  let host = 'https://service.multisked.com.br';//[...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  const domain = extractDomain(host);
  console.log(domain);

  var ip = await resolve(domain);
  const {ll, country } = geoip.lookup(ip);

  res.json({ 'data':  ll });
});



router.get('/monitorHttp', async function (req, res) {

  let listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  const responseList = await monitorHttpRequest(listHttp);
  //await monitorDNS(webAddresses);
  res.json({ 'data': responseList, 'len:': responseList.length });
});


// http://localhost:3000/monitorHttp2Elastic
router.get('/monitorHttp2Elastic', async function (req, res) {

  let listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  setInterval(async() => {
    const responseList = await monitorHttpRequest(listHttp);
    const respBatch = await sendBatch2LogStash(responseList);

    console.log('>>>', respBatch.length);
  }, 60 * 1000);


  //await monitorDNS(webAddresses);
  res.json({ 'data': 'respBatch', 'len:': 'respBatch.length' });
});




router.get('/listSslValid', async function (req, res) {

  let hostsHttps = [...new Set(hosts.split('\n'))].filter(f => f.includes('https'));
  //if (!this.flagLoaded) return;
  const validArr = await verificarCertificadosSslEmLote(hostsHttps);

  res.json(validArr);
});



router.get('/testeProcessoGpt2', async function (req, res) {

  //var listArr = [];
  let hostsX = [...new Set(hosts.split('\n'))].filter(f => f.includes('https'));

  //console.log('lista len: ', hostsX.length);

  const arrSsl = await verificarCertificadosSslEmLote(hostsX);

  //await validateSslAsync3(webAddresses);
  //await monitorDNS(webAddresses);
  res.json({ message: arrSsl, processados: arrSsl.length });
});

const webAddresses = [
  'https://service.multisked.com.br',
  'https://eadsegen.mj.gov.br',
  'https://compras.dados.gov.br'
]

const dnsAddresses = [
  'service.multisked.com.br',
  'eadsegen.mj.gov.br',
  'compras.dados.gov.br'
];


module.exports = router;
