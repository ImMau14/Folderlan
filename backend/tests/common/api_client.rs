use reqwest::{Client, Method, Response, multipart::Form};
use serde::Serialize;
use std::time::Duration;

// HTTP client wrapper for API testing
#[derive(Debug, Clone)]
pub struct ApiClient {
    base_url: String,
    client: Client,
    timeout: Duration,
}

// Request builder for fluent API calls
#[derive(Debug, Clone)]
pub struct RequestBuilder {
    client: Client,
    base_url: String,
    method: Method,
    endpoint: String,
    timeout: Duration,
    token: Option<String>,
    query_params: Vec<(String, String)>,
    headers: Vec<(String, String)>,
    body: Option<serde_json::Value>,
}

impl ApiClient {
    // Client initialization with base URL
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            client: Client::new(),
            timeout: Duration::from_secs(30),
        }
    }

    // Timeout configuration
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    // Generic request builder
    pub fn request(&self, method: Method, endpoint: &str) -> RequestBuilder {
        RequestBuilder::new(self.client.clone(), method, &self.base_url, endpoint)
            .with_timeout(self.timeout)
    }

    // Convenience method for GET requests
    pub fn get(&self, endpoint: &str) -> RequestBuilder {
        self.request(Method::GET, endpoint)
    }

    // Convenience method for POST requests
    pub fn post(&self, endpoint: &str) -> RequestBuilder {
        self.request(Method::POST, endpoint)
    }

    // Convenience method for DELETE requests
    pub fn delete(&self, endpoint: &str) -> RequestBuilder {
        self.request(Method::DELETE, endpoint)
    }
}

impl RequestBuilder {
    // Request builder initialization
    fn new(client: Client, method: Method, base_url: &str, endpoint: &str) -> Self {
        Self {
            client,
            method,
            base_url: base_url.to_string(),
            endpoint: endpoint.to_string(),
            timeout: Duration::from_secs(30),
            token: None,
            query_params: Vec::new(),
            headers: Vec::new(),
            body: None,
        }
    }

    // Request timeout setter
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    // Authentication token setter
    pub fn with_token(mut self, token: &str) -> Self {
        self.token = Some(format!("Bearer {}", token));
        self
    }

    // Query parameter adder
    pub fn with_query_param(mut self, key: &str, value: &str) -> Self {
        self.query_params.push((key.to_string(), value.to_string()));
        self
    }

    // JSON body setter
    pub fn with_json<T: Serialize + ?Sized>(mut self, body: &T) -> Self {
        self.body = Some(serde_json::to_value(body).unwrap());
        self
    }

    // URL construction with query parameters
    fn build_url(&self) -> String {
        let mut url = format!(
            "{}/{}",
            self.base_url,
            self.endpoint.trim_start_matches('/')
        );

        if !self.query_params.is_empty() {
            url.push('?');
            for (i, (key, value)) in self.query_params.iter().enumerate() {
                if i > 0 {
                    url.push('&');
                }
                url.push_str(&format!("{}={}", key, value));
            }
        }

        url
    }

    // HTTP request execution
    pub async fn send(self) -> Result<Response, reqwest::Error> {
        let url = self.build_url();
        let mut request = self
            .client
            .request(self.method.clone(), &url)
            .timeout(self.timeout);

        if let Some(token) = self.token {
            request = request.header("Authorization", token);
        }

        for (key, value) in self.headers {
            request = request.header(key, value);
        }

        if let Some(body) = self.body {
            request = request.json(&body);
        }

        request.send().await
    }

    // Multipart form data request execution
    pub async fn send_multipart(self, form: Form) -> Result<Response, reqwest::Error> {
        let url = self.build_url();
        let mut request = self
            .client
            .request(self.method.clone(), &url)
            .timeout(self.timeout)
            .multipart(form);

        if let Some(token) = self.token {
            request = request.header("Authorization", token);
        }

        for (key, value) in self.headers {
            request = request.header(key, value);
        }

        request.send().await
    }
}
