const compose = (...fns) => (...args) => fns.reduceRight((res, fn) => [fn.call(null, ...res)], args)[0];
const trace = x => {console.log(x); return x;}

const prop = (property) => object => object[property]; 
const setSrc = imgElement => value => imgElement.src = value;

const responseToJson = res => res.json();

const then = promise => func => promise.then(func);

const extractValue = json => json.value;

//Função recursiva para extrair arrays dentro de arrays
//https://stackoverflow.com/questions/34474330/how-do-i-recursively-use-the-reduce-method-in-javascript
function flat(r, a) {
    if (Array.isArray(a)) {
        return a.reduce(flat, r);
    }
    r.push(a);
    return r;
}

// Função para aplicar a função recursiva acima (flat) em um array de arrays
const flatArray = arrMult => arrMult.reduce(flat, []);

//Função assíncrona para converter os dados recebidos do Bacen (pela promise) em array
async function getFxBacen(url) {
    const response = await fetch(url, {});
    const json = await response.json();
    const arr = extractValue(json);
    return arr;
};

/*
Definição do "tipoMoeda" no site do Bacen:

Moedas tipo A: Paridade (dólar): Quantidade da moeda por uma unidade de dólar americano (USD);
Cotação (unidade monetária corrente): Quantidade de moeda corrente por uma unidade da moeda

Moedas tipo B: Paridade (dólar): Quantidade de dólar americano (USD) por uma unidade da moeda;
Cotação (unidade monetária corrente): Quantidade de moeda corrente por uma unidade da moeda
*/

//Define "dicionários" para os tipos de quota e de boletim
const dicQuoteType = {
    quote: "cotacao",
    parity: "paridade"
};

const dicBulletinType = {
    open: "Abertura",
    intermediate: "Intermediário",
    interbankClose: "Fechamento Interbancário",
    close: "Fechamento"
};


//Identifica o seletor dropdown (para escolha da taxa de câmbio)
const selectElement = document.querySelector('#fx_select')

//Função para criar as opções do seletor dropdown
//Vamos aproveitar esta função para armazenar as moedas do Bacen em dois dicionários globais
let fxType = [];
let fxName = [];
const createSelectInnerHTML = listItems => {
    for(item of listItems){
        fxType[item.simbolo] = item.tipoMoeda;
        fxName[item.simbolo] = item.nomeFormatado;
    }
    //console.log(fxType);
    //console.log(fxName);

    const selectInnerHTML = listItems.reduce((str, item) => {
        str += `<option value = "${item.simbolo}">${item.simbolo}, ${item.nomeFormatado}, tipo: ${item.tipoMoeda}</option>\n`;
        return str;
    }, '');
    return selectInnerHTML;
};

const createDisplaySelectItems = selectEl => selectStr => selectEl.innerHTML = selectStr;
const displaySelectItems = createDisplaySelectItems(selectElement);

//Captura as moedas disponíveis pela API do BACEN e preenche o seletor dropdown
fetch('https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/Moedas?$format=json&$select=simbolo,nomeFormatado,tipoMoeda')
    .then(responseToJson)
    //.then(trace)
    .then(extractValue)
    //.then(trace)
    .then(createSelectInnerHTML)
    //.then(trace)
    .then(displaySelectItems)

//Pega os elementos da página
const buttonElement = document.querySelector('#button');
const radioQuoteElements = document.getElementsByName("quoteType");
const radioBulletinElements = document.getElementsByName("bulletinType");
const chartElement = document.getElementById('chart');

//Define o dia de hoje
const today = new Date();
const todayBacenStr = ("0" + (today.getMonth() + 1).toString()).slice(-2) + '-' + ("0" + today.getDate().toString()).slice(-2) + '-' + today.getFullYear();
//console.log(todayBacenStr);

//Encapsula função de gráfico para poder passar os parâmetros
const createPlotBacen = (chartElement, fx, quoteType) => (fx_data) => {
    //Extrai dados (vamos usar for, ao invés do map, pois são várias séries, e talvez seja mais rápido...)
    const dt = [];
    const quoteBuy = [];
    const quoteSell = [];
    const parityBuy = [];
    const paritySell = [];
    for(let i=0; i < fx_data.length; i++ ){
        dt.push(fx_data[i].dataHoraCotacao);
        quoteBuy.push(fx_data[i].cotacaoCompra);
        quoteSell.push(fx_data[i].cotacaoVenda);
        parityBuy.push(fx_data[i].paridadeCompra);
        paritySell.push(fx_data[i].paridadeVenda);
    };

    const yBuy = (quoteType == 'quote') ?  quoteBuy : parityBuy;
    const ySell = (quoteType == 'quote') ? quoteSell : paritySell;
    
    let trace1 = {
        x: dt,
        y: yBuy,
        mode: 'lines',
        name: 'Compra'
    };
      
    let trace2 = {
        x: dt,
        y: ySell,
        mode: 'lines',
        name: 'Venda'
    };
       
    //Define 'data': array com os dados das séries
    var data = [trace1, trace2];
    
    //Define 'layout': objeto com parâmetros para o gráfico
    let titleStr = '';
    let yTitleStr = '';
    if(quoteType === 'quote'){
        titleStr = 'Histórico da cotação de ' + fx;
        yTitleStr = 'BRL/' + fx ;
    }
    else{
        titleStr = 'Histórico da paridade de ' + fx;
        yTitleStr = (fxType[fx] === 'A') ? 'USD/' + fx : fx + '/USD';
    }

    const layout = {
        title: titleStr,
        yaxis: {
            title: yTitleStr
        }
    };
      
    Plotly.newPlot(chartElement, data, layout);
};


//Coloca um event listener no botão, para geração do gráfico
const onClickGraph = (evt) =>{
    const fx = selectElement.value;
    //console.log(fx);
    const quoteType = [...radioQuoteElements].filter(radio => radio.checked)[0].value;
    const quoteTypeStr = dicQuoteType[quoteType]
    //console.log(quoteTypeStr)
    const bulletinType = [...radioBulletinElements].filter(radio => radio.checked)[0].value;
    const bulletinTypeStr = dicBulletinType[bulletinType]
    //console.log(bulletinTypeStr)

    //Cria função construtora da função de gráfico
    const plotBacen = createPlotBacen(chartElement, fx, quoteType);

    //Define ponto de entrada da API do Bacen
    let url = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?";
    url += `@moeda='${fx}'&@dataInicial='07-01-1994'&@dataFinalCotacao='${todayBacenStr}'&`
    url += `$filter=tipoBoletim%20eq%20'${bulletinTypeStr}'&$orderby=dataHoraCotacao%20asc&$format=json&`;
    url += "$select=paridadeCompra,paridadeVenda,cotacaoCompra,cotacaoVenda,dataHoraCotacao";
    //console.log(url);
    //const fx_data = getFxBacen(url);
    
    //Captura a série histórica solicitada e cria o gráfico
    fetch(url)
        .then(responseToJson)
        //.then(trace)
        .then(extractValue)
        //.then(trace)
        .then(plotBacen)

/*     //Plota gráfico de teste
    Plotly.plot(chartElement, [{
        x: [1, 2, 3, 4, 5],
        y: [1, 2, 4, 8, 16] }], { 
        margin: { t: 0 } }, {showSendToCloud:true} ); */
    
};
buttonElement.addEventListener('click', onClickGraph);