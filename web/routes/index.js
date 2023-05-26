var express = require('express');
const { monitorDNS, extractDomain, monitorHttpRequest } = require('../utils/monitor.dns');
const { verificarCertificadosSslEmLote } = require('../utils/certificado.validation');
const hosts = require('../utils/hosts');


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


router.get('/monitorHttp', async function (req, res) {

  let listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  const responseList = await monitorHttpRequest(listHttp);
  //await monitorDNS(webAddresses);
  res.json({ 'data': responseList, 'len:': responseList.length });
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
  'https://classind.mj.gov.br',
  'https://apm.mj.gov.br',
  'http://adm.justica.gov.br/',
  'https://tstagir.mj.gov.br',
  'https://dsvagir.mj.gov.br',
]

const dnsAddresses = [
  'service.multisked.com.br',
  'eadsegen.mj.gov.br',
  'compras.dados.gov.br'
];


module.exports = router;
