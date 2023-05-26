const sslChecker = require('ssl-checker');
const axios = require('axios');

module.exports = {

    validateSSL: async function (url) {
        return sslChecker(url, 'GET', 443);
    },

    verificarCertificadosSslEmLote: async function (url) {
        return verificarValidadeCertificadosBatch(url);
    },

}


function url2Domain(addr) {
    return (addr.includes('https://')) ? addr.split('//')[1].split('/')[0] : addr.split('/')[0];
}



async function verificarValidadeCertificadosBatch(urls) {
    try {
        const resultados = await Promise.all(
            urls.map(async(url) => {
                try {
                    const resposta = await axios.get(url);

                    //console.log(resposta.status);
                    
                    if (resposta.status === 200) {

                        //console.log('foi...');
                        
                        const certificado = await sslChecker([url].map(url2Domain)[0], 'GET', 443); //await sslChecker(url);
                        //console.log('>>> ', certificado);

                        return {
                            //url: url,
                            //valido: certificado.valid,
                            //diasRestantes: certificado.daysRemaining,
                            'url': url,
                            'valido': certificado.valid ? 'sim' : 'não',
                            'em': new Date(certificado.validFrom).toLocaleDateString('pt-br'),
                            'ate': new Date(certificado.validTo).toLocaleDateString('pt-br'),
                            'faltam': `${certificado.daysRemaining} dia(s)`
                        };
                    } else {
                        console.log('erro: ', erro.message);
                    }
                } catch (erro) {
                    console.error(`Erro ao processar a URL ${url}: `, erro.message);
                    return null;
                }
            })
        );

        // Filtrar e remover resultados nulos
        const certificadosValidos = resultados.filter((resultado) => resultado !== null);
        //console.log('validos: ', certificadosValidos.length);

        return certificadosValidos;

    } catch (erro) {
        console.error('Ocorreu um erro ao processar as URLs:', erro);
        throw erro;
    }
}
