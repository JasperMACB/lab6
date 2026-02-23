mapboxgl.accessToken = 'pk.eyJ1Ijoiam1hY2IiLCJhIjoiY21reXBnb3psMDl5cDNmb2o4dHZyYW91eSJ9.q2NCoGx9qlVwo9G6safu0g';

        let map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/dark-v10',
            zoom: 10.5,
            minZoom: 10,
            center: [-122.3361, 47.6212]
        });

        let UMBChart = null;
        const categories = ['Medium', 'High', 'Critical'];
        const colors = ['#74add1', '#f46d43', '#d73027'];

        const legend = document.getElementById('legend');
        let labels = ['<strong>Vulnerability Classification</strong>'];
        for (let i = 0; i < categories.length; i++) {
            labels.push(
                `<p class="break" style="position: relative; margin: 6px 0;">
                    <i class="dot" style="background:${colors[i]}; width:8px; height:8px;"></i>
                    <span class="dot-label" style="position: absolute; left:60px; top:50%; transform: translateY(-50%); font-size:14px;">${categories[i]}</span>
                </p>`
            );
        }
        const source = `<p style="text-align: right; font-size:10pt">Source: <a href="https://data-seattlecitygis.opendata.arcgis.com/datasets/SeattleCityGIS::unreinforced-masonry-buildings-urm/about`;
        legend.innerHTML = labels.join('') + source;

        async function geojsonFetch() {
            const response = await fetch('assets/Unreinforced_Masonry_Buildings.geojson');
            const UMBs = await response.json();

            map.on('load', () => {
                map.addSource('UMBs', { type: 'geojson', data: UMBs });
                map.addLayer({
                    id: 'UMBs-point',
                    type: 'circle',
                    source: 'UMBs',
                    minzoom: 10,
                    paint: {
                        'circle-radius': ['interpolate', ['linear'], ['zoom'],
                            10, ['match', ['get', 'VULNERABILITY_CLASSIFICATION'], 'Medium', 2, 'High', 3, 'Critical', 4, 2],
                            14, ['match', ['get', 'VULNERABILITY_CLASSIFICATION'], 'Medium', 4, 'High', 6, 'Critical', 9, 3],
                            17, ['match', ['get', 'VULNERABILITY_CLASSIFICATION'], 'Medium', 6, 'High', 9, 'Critical', 14, 4]
                        ],
                        'circle-color': ['match', ['get', 'VULNERABILITY_CLASSIFICATION'], 'Medium', '#74add1', 'High', '#f46d43', 'Critical', '#d73027', '#cccccc'],
                        'circle-opacity': 0.45,
                        'circle-stroke-color': 'rgba(255,255,255,0.6)',
                        'circle-stroke-width': 0.5
                    }
                });
            
            map.on('click', 'UMBs-point', (event) => {
                const feature = event.features[0];
                const address = feature.properties.MAF_ADDRESS || "No address available";
                const category = feature.properties.VULNERABILITY_CLASSIFICATION;
                new mapboxgl.Popup()
                    .setLngLat(feature.geometry.coordinates)
                    .setHTML(`<strong>Address:</strong> ${address}<br><strong>Category:</strong> ${category}`)
                    .addTo(map);
            });


                const counts = calUMBs(UMBs, map.getBounds());
                renderChart(counts);
            });

            map.on('idle', () => {
                const counts = calUMBs(UMBs, map.getBounds());
                if (UMBChart) {
                    const dataColumns = categories.map(c => [c, counts[c]]);
                    UMBChart.load({ columns: dataColumns, unload: true });
                    const maxCount = Math.max(...Object.values(counts), 1);
                    UMBChart.axis.max({ y: maxCount + 2 });
                }
                document.getElementById("UMB-count").innerText =
                    categories.reduce((sum, c) => sum + counts[c], 0);
            });
        }

        function calUMBs(currentUMBs, currentMapBounds) {
            const counts = { 'Medium': 0, 'High': 0, 'Critical': 0 };
            currentUMBs.features.forEach(d => {
                const [lon, lat] = d.geometry.coordinates;
                if (currentMapBounds.contains([lon, lat])) {
                    const v = d.properties.VULNERABILITY_CLASSIFICATION;
                    if (counts[v] !== undefined) counts[v] += 1;
                }
            });
            return counts;
        }

        function renderChart(counts) {
            const dataColumns = categories.map(c => [c, counts[c]]);
            const maxCount = Math.max(...Object.values(counts), 1);

            UMBChart = c3.generate({
                size: { height: 350, width: 460 },
                data: {
                    columns: dataColumns,
                    type: 'bar',
                    colors: {
                        'Medium': colors[0],
                        'High': colors[1],
                        'Critical': colors[2]
                    },
                    onclick: function(d) {
                        map.setFilter('UMBs-point', ['==', ['get', 'VULNERABILITY_CLASSIFICATION'], d.id]);
                    },
                    ids: { 'Medium': 'Medium', 'High': 'High', 'Critical': 'Critical' }
                },
                axis: {
                    x: { type: 'category', categories: categories },
                    y: { padding: { top:0, bottom:0 }, tick: { format: d3.format('d') } }
                },
                tooltip: { show: false }, // <-- disable hover tooltip
                legend: { show: false },
                bindto: "#UMB-chart"
            });

            document.getElementById("UMB-count").innerText =
                categories.reduce((sum, c) => sum + counts[c], 0);
        }

        document.getElementById('reset').addEventListener('click', () => {
            map.flyTo({ zoom: 10.5, center: [-122.3361, 47.6212] });
            map.setFilter('UMBs-point', null);
        });

        geojsonFetch();