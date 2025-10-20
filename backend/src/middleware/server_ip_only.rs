// Middleware that restricts access to localhost only
use crate::models::responses::ApiResponse;
use actix_web::{
    Error,
    body::EitherBody,
    dev::{Service, ServiceRequest, ServiceResponse, Transform, forward_ready},
};
use futures_util::future::LocalBoxFuture;
use std::{
    future::{Ready, ready},
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
};

// Middleware factory struct
pub struct LocalOnly;

// Transform implementation for converting service into middleware
impl<S, B> Transform<S, ServiceRequest> for LocalOnly
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = LocalOnlyMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        // Read LOCAL_ONLY env var at startup to enable/disable middleware.
        let local_only: bool = std::env::var("LOCAL_ONLY")
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(true);

        ready(Ok(LocalOnlyMiddleware {
            service,
            local_only,
        }))
    }
}

// Middleware service struct
pub struct LocalOnlyMiddleware<S> {
    service: S,
    local_only: bool, // Flag read from LOCAL_ONLY
}

// Service implementation for the middleware
impl<S, B> Service<ServiceRequest> for LocalOnlyMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    // Processes incoming requests and checks client IP
    fn call(&self, req: ServiceRequest) -> Self::Future {
        let peer_opt = req.peer_addr();

        // Creates forbidden response for denied requests
        fn denied_response<B>(req: ServiceRequest) -> ServiceResponse<EitherBody<B>> {
            let http_response = ApiResponse::<()>::builder()
                .message("You can access to this endpoint only from the server")
                .forbidden();
            let resp = http_response.map_into_right_body();
            req.into_response(resp)
        }

        // If protection is disabled via LOCAL_ONLY, just forward the request.
        if !self.local_only {
            // Proceed without localhost check
            let fut = self.service.call(req);
            Box::pin(async move {
                let res = fut.await?;
                Ok(res.map_into_left_body())
            })
        } else {
            // Checks if request comes from localhost
            if let Some(socket_addr) = peer_opt {
                let ip = socket_addr.ip();
                let allowed =
                    ip == IpAddr::V4(Ipv4Addr::LOCALHOST) || ip == IpAddr::V6(Ipv6Addr::LOCALHOST);

                if allowed {
                    // Proceeds with request processing for localhost
                    let fut = self.service.call(req);
                    Box::pin(async move {
                        let res = fut.await?;
                        Ok(res.map_into_left_body())
                    })
                } else {
                    // Returns forbidden response for non-localhost
                    Box::pin(async move { Ok(denied_response(req)) })
                }
            } else {
                // Returns forbidden response if IP cannot be determined
                Box::pin(async move { Ok(denied_response(req)) })
            }
        }
    }
}
