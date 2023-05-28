var express = require('express');

const axios = require('axios');

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
  const { ll, country } = geoip.lookup(ip);

  res.json({ 'data': ll });
});


/**
 * Executar o banco json antes: npm run db
 * http://localhost:3000/monitorHttp
 */
router.get('/monitorHttp', async function (req, res) {

  let listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  const responseList = await monitorHttpRequest(listHttp);

  //console.log(responseList)
  fetchPost('http://localhost:3001/tracks', responseList).then((s) => {
    console.log(s);
  })

  //await monitorDNS(webAddresses);
  res.json({ 'data': responseList, 'len:': responseList.length });
});


async function fetchPost(url, arrObj) {
  try {
    console.log('>>> ', arrObj);

    const resultados = await Promise.all(
      arrObj.map(async (obj) => {
        try {

          //adiciona o registro de log
          obj.ts = new Date().getTime();

          const resposta = await axios.post(url, obj);
          //console.log(resposta.status);
          return {
            //url: url,
            //valido: certificado.valid,
            //diasRestantes: certificado.daysRemaining,
            'url': url,
            'status': resposta.status,
          };

        } catch (erro) {
          console.error(`Erro ao processar a URL ${url}: `, erro.message);
          return erro.message;
        }
      })
    );

    // Filtrar e remover resultados nulos
    //const requestsValidos = resultados.filter((res) => res !== null);
    //console.log('validos: ', certificadosValidos.length);

    return resultados;

  } catch (erro) {
    console.error('Ocorreu um erro ao processar as URL:', erro.message);
    throw erro;
  }
}


// http://localhost:3000/monitorHttp2Elastic
router.get('/monitorHttp2Elastic', async function (req, res) {

  let listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  setInterval(async () => {
    const responseList = await monitorHttpRequest(listHttp);
    const respBatch = await sendBatch2LogStash(responseList);

    console.log('>>>', respBatch.length);
  }, 60 * 1000);


  //await monitorDNS(webAddresses);
  res.json({ 'message': 'executando batch logstash', 'timeBatch:': '60s' });
});


router.get('/graphLogTrack', async function (req, res) {

  //const listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  const dataset = await axios.get('http://localhost:3001/tracks');
  const arrData = Array.from(dataset.data);

  console.log(arrData.length);

  const hostsn = arrData.map((m, i) => ({
    'id': i,
    'label': m.url.split('/')[2],
    'status': m.status,
    'rt': m.tempoDeResposta,
    'url': m.url,
    'depends_on': [i, random(i, arrData.length - 1)]
  }))

  const nodes = [...hostsn].map((m, i) => ({
    'id': i,
    'label': m.label,
    'color': getNodeColor(m.status),
    'x': random(0, 100),
    'y': random(0, 100),
    'size': hostsn.map(m => (m.depends_on)).flatMap(f => (f)).filter(x => (x === m.id)).length
  }))

  const edges = hostsn.flatMap((m, y) => (
    m.depends_on.map((t) => ({
      id: random(0, 99999999),
      source: nodes[m.id].id,
      target: nodes[t].id,
      //label: 'rt: ' + m.rt,
      count: m.depends_on.length,
      color:  '#ccc' //getEdgeColor(m.rt)
    }))
  ));

  //const responseList = await monitorHttpRequest(listHttp);
  //await monitorDNS(webAddresses);
  res.json({ 'data': [{ 'nodes': nodes, 'edges': edges }], 'nodes:': nodes.length, 'edges': edges.length });
});



router.get('/graphTest', async function (req, res) {

  const listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  const hostsn = listHttp.map((m, i) => ({
    'id': i,
    'label': m.split('/')[2],
    'url': m,
    'rt': +m.tempoDeResposta,
    'depends_on': [i, random(i, listHttp.length - 1)]
  }))

  const nodes = [...hostsn].map((m, i) => ({
    'id': i,
    'label': m.label,
    'x': random(0, 100),
    'y': random(0, 100),
    'size': 1.5 + hostsn.map(m => (m.depends_on)).flatMap(f => (f)).filter(x => (x === m.id)).length
  }))

  const edges = hostsn.flatMap(m => (
    m.depends_on.map((t, i) => ({
      id: random(0, 999999),
      source: nodes[m.id].id,
      target: nodes[t].id, 
      color:  '#ccc'//getEdgeColor(m.rt)
    }))
  ));

  //const responseList = await monitorHttpRequest(listHttp);
  //await monitorDNS(webAddresses);
  res.json({ 'data': [{ 'nodes': nodes, 'edges': edges }], 'nodes:': nodes.length, 'edges': edges.length });
});



function getNodeColor(status) {
  switch (status) {
    case 404:
      return 'red'
    case 200:
      return 'green'
    default:
      return 'gray';
  }
}

/**
 * Obtem a cor das ligacoes pelo tempo de resposta
 * das conexoes
 * @param {*} rt 
 * @returns 
 */
function getEdgeColor(rt) {
  if(rt === 0){
    return 'gray';
  }else if(rt < 3000){
    return 'green';
  }else if(rt < 10000){
    return 'yellow';
  }else{
    return 'orange';
  }
}

function random(min, max) {
  return Math.ceil(Math.random() * (max - min) + min);
}


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
