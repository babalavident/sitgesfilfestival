
function InfoFormatter(value) {
    return "<a href='" + value + "' target='_blank'>Movie info</a>"
}

function parseRow(row) {

    var session = {};

    var cells = row.getElementsByTagName('td');
    if (cells.length) {
        var date = cells[1].textContent.replace(/\s+/g, " ").trim();
        var pieces = date.split(" ");
        var day = pieces[0];
        var hour = pieces[1];
        
        var day_pieces = day.split("-");
        var day_coded = parseInt(day_pieces[2] + day_pieces[1] + day_pieces[0]);
        
        var title = cells[2].textContent.replace(/\n\s+/g, "\n").trim();
        var info_url = cells[2].getElementsByTagName('a')[0].getAttribute('href');
        var place = cells[3].textContent.trim();
        var section = cells[4].textContent;
        var duration = cells[5].textContent.trim();
        
        var buy_url = null;
        var sessionId = null;
        var a_tags = cells[6].getElementsByTagName('a');
        if (a_tags.length) {     
            
            buy_url = a_tags[0].getAttribute('href');
            var pieces = buy_url.split("=");
            if (pieces.length > 1) {
                sessionId = pieces.slice(-1)[0];
            }
        }
        
        session['title'] = title.replace(/\n/, "<br/>");
        session['info_url'] = info_url;
        session['date'] = date;
        session['day'] = day;
        session['hour'] = hour;
        session['day_coded'] = day_coded;
        session['place'] = place;
        session['duration'] = duration;
        session['buy_url'] = buy_url;
        session['sessionId'] = sessionId;
    }
    
    return session;
}

function retrieveCapacity(sessionInfo) {
    var proxy = "https://cors-anywhere.herokuapp.com/";
    var url = "https://www.4tickets.es/repositorios/repo43r4/public/cgi/Gateway.php";

    var date = new Date();
    var now = parseInt(date.toJSON().replace(/-|T|:/g, "").substring(0, 14)) + 20000;
                        
    var capacity_request_data = {'IdTerminalWeb': '9455',
                                'Idioma': {'0': '02', '1': '02'},
                                'Nivel': 'Detalle_1_Sesion',
                                'UserSession': 'd:1538843123.73538494110107421875;',
                                'idIdioma': 'CA',
                                'idSesion': sessionInfo['sessionId'],
                                'instala': '_4TICK',
                                'seccion': '1',
                                'timeStamp': now};
                        
    var promise = $.ajax({
                type: 'POST',
                url: proxy + url,
                data: capacity_request_data,
                dataType: 'text'
            })
            .then(function (data, textStatus, jqXHR) {
                
                try {
                    var json = JSON.parse(data.substring(8));
                    var capacity = json[0]["Sesion"]["Sesion"][0];
                
                    sessionInfo['agotado'] = capacity["Agotado"];
                    sessionInfo['aforo'] = parseInt(capacity["AforoTotal"]);
                    sessionInfo['ocupado'] = parseInt(capacity["AforoOcupado"]);
                    sessionInfo['libres_real'] = sessionInfo['aforo'] - sessionInfo['ocupado'];
                    
                } catch(e) {
                    console.log('Something happened while retrieving capacity!\n' + e)
                    sessionInfo['agotado'] = null;
                    sessionInfo['aforo'] = null;
                    sessionInfo['ocupado'] = null;
                    sessionInfo['libres_real'] = null;
                }
            },
            function (data, textStatus, jqXHR) {
                console.log("Error!: " + textStatus);
            });
            
    return promise;
}

function retrieveSeats(sessionInfo) {
    var proxy = "https://cors-anywhere.herokuapp.com/";
    var url = "https://www.4tickets.es/repositorios/repo43r4/public/cgi/Gateway.php";

    var date = new Date();
    var now = parseInt(date.toJSON().replace(/-|T|:/g, "").substring(0, 14)) + 20000;
    
    var seat_request_data = {'IdTerminalWeb': '9455',
                            'Idioma': {'0': '02', '1': '02'},
                            'Nivel': 'DetalleAforo',
                            'UserSession': 'd:1538843123.73538494110107421875;',
                            'idIdioma': 'CA',
                            'idSesion': sessionInfo['sessionId'],
                            'instala': '_4TICK',
                            'seccion': '4',
                            'idRecinto': 'FS4',
                            'idEvento': 'SFF17_303',
                            'IDsRecinto': '0;FS4',
                            'IDSEvento': '0;SFF17_303',
                            'conexiones': '0',
                            'idTipoE': '251',
                            'Etiquetas': '0000000000111489',
                            'NivelPrecios': '0',
                            'timeStamp': now};
                        
    var promise = $.ajax({
                type: 'POST',
                url: proxy + url,
                data: seat_request_data,
                dataType: 'text'
            })
            .then(function (data, textStatus, jqXHR) {

                try {
                    var regex = /"Disponible" *: *"(\d+)"/g;
                    var match = regex.exec(data);

                    var seats = 0;
                    while (match != null) {
                        seats += parseInt(match[1]);
                        match = regex.exec(data);
                    }
                    sessionInfo['libres'] = seats/2;
                } catch(e) {
                    console.log('Something happened while retrieving seats!\n' + e)
                    sessionInfo['libres'] = null;
                }
            },
            function (data, textStatus, jqXHR) {
                console.log("Error!: " + textStatus);
            });
            
    return promise;
}

function processMovieData(data, day_coded, callback_capacity) {
    
    var parser = new DOMParser();
    var htmlDoc = parser.parseFromString(data, "text/html");
    
    var table = htmlDoc.getElementById("program-table");
    
    var promises = [];
    var movie_list = [];
    var rows = table.getElementsByTagName('tr');
    for (i = 0; i < rows.length; i++) {
        var sessionInfo = parseRow(rows[i]);
        if (sessionInfo && sessionInfo['day_coded'] == day_coded) {
            if (sessionInfo['sessionId']) {
                promises.push(retrieveCapacity(sessionInfo));
                promises.push(retrieveSeats(sessionInfo));
            }
            movie_list.push(sessionInfo);
        }
    }
    
    Promise.all(promises).then(function() {
            date_info[day_coded] = movie_list;
            $('#movie_table').bootstrapTable('hideLoading');
            $('#movie_table').bootstrapTable('load', movie_list);
	    $('#dates').removeAttr('disabled');
        })
    
    return movie_list;
}

date_info = {};

function extractData(day) {

    if (day in date_info) {
        $('#movie_table').bootstrapTable('hideLoading');
        $('#movie_table').bootstrapTable('load', date_info[day]);

    } else {
	$('#dates').attr('disabled', 'disabled');
        $('#movie_table').bootstrapTable('showLoading');

        var proxy = "https://cors-anywhere.herokuapp.com/";
        var url = "http://sitgesfilmfestival.com/cat/programa";
    
        $.ajax({
            type: 'GET',
            url: proxy + url
            
        }).then(function (data, textStatus, jqXHR) {
            //alert("Ok!");
            //console.log(data);

            var movie_list = processMovieData(data, day);
                
            },
            function (jqXHR, textStatus, errorThrown) {
                alert("Wait, take a look: " + textStatus + ", " + errorThrown);
            }
        );
    }
}

$(function () {
    $('#movie_table').bootstrapTable('showLoading');

    $('#dates')[0].onchange = function() {
    	extractData(this.value);
    };

    var date = new Date();
    var now = parseInt(date.toJSON().replace(/-|T|:/g, "").substring(0, 8));
    $('#dates')[0].value = now;
    extractData(now);
});
